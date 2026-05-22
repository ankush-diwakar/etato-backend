import crypto from "crypto";
import { execute, query, withTransaction } from "../config/db.js";
import Razorpay from "razorpay";
import { env } from "../config/env.js";


const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID || "dummy",
  key_secret: env.RAZORPAY_KEY_SECRET || "dummy",
});

// Generate ET-YYYYMMDD-XXX
const generateOrderNumber = async () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

  const rows = await query(
    "SELECT orderNumber FROM orders WHERE orderNumber LIKE ? ORDER BY orderNumber DESC LIMIT 1",
    [`ET-${dateStr}-%`]
  );
  const lastOrder = rows[0];

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
    const addressRows = await query(
      "SELECT id, isInZone FROM addresses WHERE id = ? AND userId = ? LIMIT 1",
      [addressId, userId]
    );
    const address = addressRows[0];
    if (!address) return res.status(404).json({ error: "Address not found" });
    if (!address.isInZone) return res.status(400).json({ error: "Address is not in delivery zone" });

    // Calculate subtotal securely using DB prices
    let subtotal = 0;
    const orderItemsData = [];

    const ids = items.map((item) => item.menuItemId);
    const placeholders = ids.map(() => "?").join(", ");
    const menuRows = await query(
      `SELECT id, name, price, status FROM menu_items WHERE id IN (${placeholders})`,
      ids
    );
    const menuMap = new Map(menuRows.map((row) => [row.id, row]));

    for (const item of items) {
      const menuItem = menuMap.get(item.menuItemId);
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
      const couponRows = await query("SELECT * FROM coupons WHERE code = ? LIMIT 1", [couponCode]);
      const coupon = couponRows[0];
      if (coupon && coupon.isActive) {
        // Apply discount percentage
        discount = Math.floor((subtotal * coupon.discountPct) / 100);
      }
    }

    const deliveryCharge = 0; // Adjust as per business logic
    const total = subtotal - discount + deliveryCharge;

    const orderNumber = await generateOrderNumber();

    const order = await withTransaction(async (conn) => {
      const orderId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO orders
          (id, orderNumber, userId, addressId, status, deliverySlot, dietaryPref, specialNotes, subtotal, deliveryCharge, discount, couponCode, total, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
        [
          orderId,
          orderNumber,
          userId,
          addressId,
          deliverySlot,
          dietaryPref || "REGULAR_VEG",
          specialNotes || null,
          subtotal,
          deliveryCharge,
          discount,
          couponCode || null,
          total,
        ]
      );

      if (orderItemsData.length > 0) {
        const itemValues = [];
        const valuePlaceholders = orderItemsData.map((item) => {
          itemValues.push(crypto.randomUUID(), orderId, item.menuItemId, item.quantity, item.unitPrice, item.total);
          return "(?, ?, ?, ?, ?, ?)";
        });

        await conn.execute(
          `INSERT INTO order_items (id, orderId, menuItemId, quantity, unitPrice, total) VALUES ${valuePlaceholders.join(", ")}`,
          itemValues
        );
      }

      const [rows] = await conn.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
      return rows[0];
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
    await execute(
      `INSERT INTO payments
        (id, orderId, razorpayOrderId, amount, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'PENDING', NOW(3), NOW(3))`,
      [crypto.randomUUID(), order.id, razorpayOrder.id, total * 100]
    );

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
      const paymentRows = await query(
        "SELECT * FROM payments WHERE razorpayOrderId = ? LIMIT 1",
        [razorpay_order_id]
      );
      const payment = paymentRows[0];

      if (!payment) return res.status(404).json({ error: "Payment record not found" });

      await withTransaction(async (conn) => {
        await conn.execute(
          `UPDATE payments SET razorpayPaymentId = ?, razorpaySignature = ?, status = 'CAPTURED', paidAt = ?, updatedAt = NOW(3) WHERE id = ?`,
          [razorpay_payment_id, razorpay_signature, new Date(), payment.id]
        );
        await conn.execute(
          "UPDATE orders SET status = 'CONFIRMED', updatedAt = NOW(3) WHERE id = ?",
          [payment.orderId]
        );
      });

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
    const orders = await query(
      "SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC",
      [req.user.id]
    );

    if (orders.length === 0) {
      return res.json({ orders: [] });
    }

    const orderIds = orders.map((o) => o.id);
    const placeholders = orderIds.map(() => "?").join(", ");

    const items = await query(
      `SELECT
          oi.id AS order_item_id,
          oi.orderId AS order_id,
          oi.menuItemId AS menu_item_id,
          oi.quantity,
          oi.unitPrice,
          oi.total,
          mi.id AS menu_id,
          mi.name,
          mi.slug,
          mi.dressing,
          mi.categoryId,
          mi.protein,
          mi.calories,
          mi.carbs,
          mi.fat,
          mi.fiber,
          mi.ingredients,
          mi.price,
          mi.jain,
          mi.imageUrl,
          mi.status,
          mi.isFeatured,
          mi.sortOrder,
          mi.createdAt AS menu_createdAt,
          mi.updatedAt AS menu_updatedAt
       FROM order_items oi
       JOIN menu_items mi ON oi.menuItemId = mi.id
       WHERE oi.orderId IN (${placeholders})`,
      orderIds
    );

    const payments = await query(
      `SELECT * FROM payments WHERE orderId IN (${placeholders})`,
      orderIds
    );

    const itemsByOrder = new Map();
    for (const row of items) {
      const menuItem = {
        id: row.menu_id,
        name: row.name,
        slug: row.slug,
        dressing: row.dressing,
        categoryId: row.categoryId,
        protein: row.protein,
        calories: row.calories,
        carbs: row.carbs,
        fat: row.fat,
        fiber: row.fiber,
        ingredients: typeof row.ingredients === "string" ? JSON.parse(row.ingredients) : row.ingredients,
        price: row.price,
        jain: row.jain,
        imageUrl: row.imageUrl,
        status: row.status,
        isFeatured: row.isFeatured,
        sortOrder: row.sortOrder,
        createdAt: row.menu_createdAt,
        updatedAt: row.menu_updatedAt,
      };

      const item = {
        id: row.order_item_id,
        orderId: row.order_id,
        menuItemId: row.menu_item_id,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        total: row.total,
        menuItem,
      };

      if (!itemsByOrder.has(row.order_id)) itemsByOrder.set(row.order_id, []);
      itemsByOrder.get(row.order_id).push(item);
    }

    const paymentByOrder = new Map(payments.map((p) => [p.orderId, p]));

    const enriched = orders.map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) || [],
      payment: paymentByOrder.get(order.id) || null,
    }));

    res.json({ orders: enriched });
  } catch (error) {
    next(error);
  }
};
