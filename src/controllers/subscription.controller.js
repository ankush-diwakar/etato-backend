import prisma from "../config/db.js";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import crypto from "crypto";
import { sendSubscriptionAdminAlert } from "../services/mail.service.js";

const razorpay = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID || "dummy",
    key_secret: env.RAZORPAY_KEY_SECRET || "dummy",
});

export const getPlans = async (req, res, next) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" }
        });
        res.json({ plans });
    } catch (err) {
        next(err);
    }
};

export const createSubscription = async (req, res, next) => {
    try {
        const { planId, deliverySlot, dietaryPref, bowlPreference, startDate, specialNotes, addressId } = req.body;
        const userId = req.user.id;

        if (!planId || !deliverySlot || !startDate || !addressId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
            return res.status(400).json({ error: "Invalid start date" });
        }

        // Check plan
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan || !plan.isActive) {
            return res.status(404).json({ error: "Subscription plan not found or inactive" });
        }

        // Check address
        const address = await prisma.address.findUnique({
            where: { id: addressId, userId },
        });
        if (!address) return res.status(404).json({ error: "Address not found" });
        if (!address.isInZone) return res.status(400).json({ error: "Address is not in delivery zone" });

        // ── Guard: block if user already has an ACTIVE or PAUSED subscription ──
        const existingActiveSub = await prisma.subscription.findFirst({
            where: {
                userId,
                status: { in: ["ACTIVE", "PAUSED"] },
            },
        });
        if (existingActiveSub) {
            return res.status(409).json({ error: "You already have an active subscription" });
        }

        // Calculate end date (simplified: add durationDays)
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);

        // ── Create Subscription with PENDING status ──
        // Status will be flipped to ACTIVE only after payment is verified.
        const subscription = await prisma.subscription.create({
            data: {
                userId,
                planId,
                deliverySlot,
                dietaryPref: dietaryPref || "REGULAR_VEG",
                bowlPreference,
                startDate: start,
                endDate: end,
                specialNotes,
                status: "PENDING",
            }
        });

        const total = plan.price;
        let razorpayOrder;
        try {
            razorpayOrder = await razorpay.orders.create({
                amount: total * 100, // paise
                currency: "INR",
                receipt: subscription.id,
                notes: {
                    subscriptionId: subscription.id,
                },
            });
        } catch (rzpErr) {
            // Clean up the subscription record so the user can retry
            await prisma.subscription.delete({ where: { id: subscription.id } });
            return res.status(500).json({ error: "Failed to initialize payment gateway" });
        }

        await prisma.payment.create({
            data: {
                subscriptionId: subscription.id,
                razorpayOrderId: razorpayOrder.id,
                amount: total * 100,
                status: "PENDING",
            },
        });

        res.status(201).json({
            message: "Subscription created",
            subscriptionId: subscription.id,
            razorpayOrderId: razorpayOrder.id,
            amount: total * 100,
        });
    } catch (error) {
        next(error);
    }
};

export const verifySubscriptionPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: "Invalid payment signature" });
        }

        const payment = await prisma.payment.findUnique({
            where: { razorpayOrderId: razorpay_order_id },
        });

        if (!payment) return res.status(404).json({ error: "Payment record not found" });
        if (!payment.subscriptionId) return res.status(400).json({ error: "Payment is not linked to a subscription" });

        // ── Mark payment as CAPTURED ──
        await prisma.payment.update({
            where: { id: payment.id },
            data: {
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature,
                status: "CAPTURED",
                paidAt: new Date(),
            },
        });

        // ── Activate the subscription now that payment is confirmed ──
        await prisma.subscription.update({
            where: { id: payment.subscriptionId },
            data: { status: "ACTIVE" },
        });

        // Get full subscription info and user info to send alert
        const subscriptionInfo = await prisma.subscription.findUnique({
            where: { id: payment.subscriptionId },
            include: { user: true, plan: true }
        });

        if (subscriptionInfo) {
            await sendSubscriptionAdminAlert(subscriptionInfo);
        }

        res.json({ message: "Subscription payment verified successfully", subscriptionId: payment.subscriptionId });
    } catch (error) {
        next(error);
    }
};

export const getUserSubscriptions = async (req, res, next) => {
    try {
        const subscriptions = await prisma.subscription.findMany({
            where: { userId: req.user.id },
            include: {
                plan: true,
                payment: true,
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ subscriptions });
    } catch (error) {
        next(error);
    }
};

export const getSubscriptionDetail = async (req, res, next) => {
    try {
        const subscription = await prisma.subscription.findFirst({
            where: { id: req.params.id, userId: req.user.id },
            include: {
                plan: true,
                payment: true,
            },
        });
        if (!subscription) return res.status(404).json({ error: "Subscription not found" });
        res.json({ subscription });
    } catch (error) {
        next(error);
    }
};

// Called when the user dismisses the Razorpay modal or payment fails.
// Cleans up the PENDING subscription + payment so the user can start fresh.
export const cancelPendingSubscription = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const subscription = await prisma.subscription.findFirst({
            where: { id, userId },
        });

        if (!subscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }

        // Only allow deletion if payment was never captured
        if (subscription.status !== "PENDING") {
            return res.status(400).json({ error: "Only pending subscriptions can be deleted" });
        }

        // Delete payment first (FK constraint), then subscription
        await prisma.payment.deleteMany({ where: { subscriptionId: id } });
        await prisma.subscription.delete({ where: { id } });

        res.json({ message: "Pending subscription removed" });
    } catch (error) {
        next(error);
    }
};
