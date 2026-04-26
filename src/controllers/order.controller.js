import prisma from "../config/db.js";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || "dummy",
  key_secret: env.RAZORPAY_KEY_SECRET || "dummy",
});

// Generate ET-YYYYMMDD-XXX
const generateOrderNumber = async () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  
  const lastOrder = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: `ET-${dateStr}` } },
    orderBy: { orderNumber: "desc" },
  });

  let seq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.split("-")[2], 10);
    seq = lastSeq + 1;
  }
  return `ET-${dateStr}-${seq.toString().padStart(3, "0")}`;
};

export const createOrder = async (req, res, next) => {
  try {
    const { items, addressId, deliverySlot, dietaryPref, specialNotes, couponCode } = req.body;
    const userId = req.user.id;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }
    if (!addressId) return res.status(400).json({ error: "Address is required" });
    if (!deliverySlot) return res.status(400).json({ error: "Delivery slot is required" });

    // Get user address
    const address = await prisma.address.findUnique({
      where: { id: addressId, userId },
    });
    if (!address) return res.status(404).json({ error: "Address not found" });
    if (!address.isInZone) return res.status(400).json({ error: "Address is not in delivery zone" });

    // Calculate subtotal securely using DB prices
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });
      if (!menuItem) return res.status(404).json({ error: `Menu item ${item.menuItemId} not found` });
      if (menuItem.status !== "ACTIVE") return res.status(400).json({ error: `${menuItem.name} is currently not available` });
      if (!menuItem.price) return res.status(400).json({ error: `${menuItem.name} price not set` });

      const itemTotal = menuItem.price * item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        total: itemTotal,
      });
    }

    let discount = 0;
    // Basic coupon logic
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponCode },
      });
      if (coupon && coupon.isActive) {
        // Apply discount percentage
        discount = Math.floor((subtotal * coupon.discountPct) / 100);
      }
    }

    const deliveryCharge = 0; // Adjust as per business logic
    const total = subtotal - discount + deliveryCharge;

    const orderNumber = await generateOrderNumber();

    // Create Order + Items in DB
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        addressId,
        deliverySlot,
        dietaryPref: dietaryPref || "REGULAR_VEG",
        specialNotes,
        subtotal,
        discount,
        couponCode,
        deliveryCharge,
        total,
        items: {
          create: orderItemsData,
        },
      },
    });

    // Create Razorpay Order
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: total * 100, // Convert rupees → paise
        currency: "INR",
        receipt: order.orderNumber,
        notes: {
          orderId: order.id,
        },
      });
    } catch (rzpErr) {
      // If Razorpay fails, we could delete the order or leave it as PENDING and retry later.
      return res.status(500).json({ error: "Failed to initialize payment gateway" });
    }

    // Create Payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        razorpayOrderId: razorpayOrder.id,
        amount: total * 100, // Store in paise
        status: "PENDING",
      },
    });

    res.status(201).json({
      message: "Order created",
      orderId: order.id,
      orderNumber: order.orderNumber,
      razorpayOrderId: razorpayOrder.id,
      amount: total * 100, // Return in paise for Razorpay frontend
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // Valid signature
      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (!payment) return res.status(404).json({ error: "Payment record not found" });

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            status: "CAPTURED",
            paidAt: new Date(),
          },
        }),
        prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: "CONFIRMED",
          },
        }),
      ]);

      res.json({ message: "Payment verified successfully", orderId: payment.orderId });
    } else {
      return res.status(400).json({ error: "Invalid payment signature" });
    }
  } catch (error) {
    next(error);
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: {
        items: { include: { menuItem: true } },
        payment: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ orders });
  } catch (error) {
    next(error);
  }
};
