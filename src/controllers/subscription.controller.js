import crypto from "crypto";
import { execute, query, withTransaction } from "../config/db.js";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import { sendSubscriptionAdminAlert } from "../services/mail.service.js";

const razorpay = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID || "dummy",
    key_secret: env.RAZORPAY_KEY_SECRET || "dummy",
});

export const getPlans = async (req, res, next) => {
    try {
        const plans = await query(
            "SELECT * FROM subscription_plans WHERE isActive = 1 ORDER BY sortOrder ASC"
        );
        const normalized = plans.map((p) => ({
            ...p,
            includes: typeof p.includes === "string" ? (() => {
                try { return JSON.parse(p.includes); } catch (_) { return []; }
            })() : (p.includes || []),
        }));
        res.json({ plans: normalized });
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
        const planRows = await query("SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [planId]);
        const plan = planRows[0];
        if (!plan || !plan.isActive) {
            return res.status(404).json({ error: "Subscription plan not found or inactive" });
        }

        // Check address
        const addressRows = await query(
            "SELECT id, isInZone FROM addresses WHERE id = ? AND userId = ? LIMIT 1",
            [addressId, userId]
        );
        const address = addressRows[0];
        if (!address) return res.status(404).json({ error: "Address not found" });
        if (!address.isInZone) return res.status(400).json({ error: "Address is not in delivery zone" });

        // ── Guard: block if user already has an ACTIVE or PAUSED subscription ──
        const existingActive = await query(
            "SELECT id FROM subscriptions WHERE userId = ? AND status IN ('ACTIVE', 'PAUSED') LIMIT 1",
            [userId]
        );
        if (existingActive.length > 0) {
            return res.status(409).json({ error: "You already have an active subscription" });
        }

        // Calculate end date (simplified: add durationDays)
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);

        // ── Create Subscription with PENDING status ──
        // Status will be flipped to ACTIVE only after payment is verified.
        const subscriptionId = crypto.randomUUID();
        await execute(
            `INSERT INTO subscriptions
             (id, userId, planId, status, deliverySlot, dietaryPref, bowlPreference, startDate, endDate, pausedDays, specialNotes, createdAt, updatedAt)
             VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, 0, ?, NOW(3), NOW(3))`,
            [subscriptionId, userId, planId, deliverySlot, dietaryPref || "REGULAR_VEG", bowlPreference || null, start, end, specialNotes || null]
        );

        const total = plan.price;
        let razorpayOrder;
        try {
            razorpayOrder = await razorpay.orders.create({
                amount: total * 100, // paise
                currency: "INR",
                receipt: subscriptionId,
                notes: {
                    subscriptionId,
                },
            });
        } catch (rzpErr) {
            // Clean up the subscription record so the user can retry
            await execute("DELETE FROM subscriptions WHERE id = ?", [subscriptionId]);
            return res.status(500).json({ error: "Failed to initialize payment gateway" });
        }

        await execute(
            `INSERT INTO payments
             (id, subscriptionId, razorpayOrderId, amount, status, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'PENDING', NOW(3), NOW(3))`,
            [crypto.randomUUID(), subscriptionId, razorpayOrder.id, total * 100]
        );

        res.status(201).json({
            message: "Subscription created",
            subscriptionId,
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

        const paymentRows = await query(
            "SELECT * FROM payments WHERE razorpayOrderId = ? LIMIT 1",
            [razorpay_order_id]
        );
        const payment = paymentRows[0];

        if (!payment) return res.status(404).json({ error: "Payment record not found" });
        if (!payment.subscriptionId) return res.status(400).json({ error: "Payment is not linked to a subscription" });

        // ── Mark payment as CAPTURED ──
        await withTransaction(async (conn) => {
            await conn.execute(
                `UPDATE payments SET razorpayPaymentId = ?, razorpaySignature = ?, status = 'CAPTURED', paidAt = ?, updatedAt = NOW(3) WHERE id = ?`,
                [razorpay_payment_id, razorpay_signature, new Date(), payment.id]
            );
            await conn.execute(
                "UPDATE subscriptions SET status = 'ACTIVE', updatedAt = NOW(3) WHERE id = ?",
                [payment.subscriptionId]
            );
        });

        // Get full subscription info and user info to send alert
        const infoRows = await query(
            `SELECT s.*, u.id AS user_id, u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.role AS user_role,
                    p.id AS plan_id, p.name AS plan_name, p.type AS plan_type, p.durationDays, p.bowlsCount, p.originalPrice, p.price, p.discountPct, p.perBowlPrice
             FROM subscriptions s
             JOIN users u ON s.userId = u.id
             JOIN subscription_plans p ON s.planId = p.id
             WHERE s.id = ?`,
            [payment.subscriptionId]
        );
        const subscriptionInfo = infoRows[0];

        if (subscriptionInfo) {
            const payload = {
                ...subscriptionInfo,
                user: {
                    id: subscriptionInfo.user_id,
                    name: subscriptionInfo.user_name,
                    email: subscriptionInfo.user_email,
                    phone: subscriptionInfo.user_phone,
                    role: subscriptionInfo.user_role,
                },
                plan: {
                    id: subscriptionInfo.plan_id,
                    name: subscriptionInfo.plan_name,
                    type: subscriptionInfo.plan_type,
                    durationDays: subscriptionInfo.durationDays,
                    bowlsCount: subscriptionInfo.bowlsCount,
                    originalPrice: subscriptionInfo.originalPrice,
                    price: subscriptionInfo.price,
                    discountPct: subscriptionInfo.discountPct,
                    perBowlPrice: subscriptionInfo.perBowlPrice,
                }
            };
            await sendSubscriptionAdminAlert(payload);
        }

        res.json({ message: "Subscription payment verified successfully", subscriptionId: payment.subscriptionId });
    } catch (error) {
        next(error);
    }
};

export const getUserSubscriptions = async (req, res, next) => {
    try {
        const subs = await query(
            `SELECT s.*, p.id AS plan_id, p.name AS plan_name, p.type AS plan_type, p.durationDays, p.bowlsCount, p.originalPrice, p.price, p.discountPct, p.perBowlPrice, p.isActive, p.sortOrder
             FROM subscriptions s
             JOIN subscription_plans p ON s.planId = p.id
             WHERE s.userId = ?
             ORDER BY s.createdAt DESC`,
            [req.user.id]
        );

        const subIds = subs.map((s) => s.id);
        const payments = subIds.length
            ? await query(
                `SELECT * FROM payments WHERE subscriptionId IN (${subIds.map(() => "?").join(", ")})`,
                subIds
            )
            : [];

        const paymentBySub = new Map(payments.map((p) => [p.subscriptionId, p]));

        const subscriptions = subs.map((s) => ({
            ...s,
            plan: {
                id: s.plan_id,
                name: s.plan_name,
                type: s.plan_type,
                durationDays: s.durationDays,
                bowlsCount: s.bowlsCount,
                originalPrice: s.originalPrice,
                price: s.price,
                discountPct: s.discountPct,
                perBowlPrice: s.perBowlPrice,
                isActive: s.isActive,
                sortOrder: s.sortOrder,
            },
            payment: paymentBySub.get(s.id) || null,
        }));

        res.json({ subscriptions });
    } catch (error) {
        next(error);
    }
};

export const getSubscriptionDetail = async (req, res, next) => {
    try {
        const rows = await query(
            `SELECT s.*, p.id AS plan_id, p.name AS plan_name, p.type AS plan_type, p.durationDays, p.bowlsCount, p.originalPrice, p.price, p.discountPct, p.perBowlPrice, p.isActive, p.sortOrder
             FROM subscriptions s
             JOIN subscription_plans p ON s.planId = p.id
             WHERE s.id = ? AND s.userId = ?
             LIMIT 1`,
            [req.params.id, req.user.id]
        );
        const subscription = rows[0];
        if (!subscription) return res.status(404).json({ error: "Subscription not found" });

        const paymentRows = await query(
            "SELECT * FROM payments WHERE subscriptionId = ? LIMIT 1",
            [subscription.id]
        );
        const payment = paymentRows[0] || null;

        res.json({
            subscription: {
                ...subscription,
                plan: {
                    id: subscription.plan_id,
                    name: subscription.plan_name,
                    type: subscription.plan_type,
                    durationDays: subscription.durationDays,
                    bowlsCount: subscription.bowlsCount,
                    originalPrice: subscription.originalPrice,
                    price: subscription.price,
                    discountPct: subscription.discountPct,
                    perBowlPrice: subscription.perBowlPrice,
                    isActive: subscription.isActive,
                    sortOrder: subscription.sortOrder,
                },
                payment,
            }
        });
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

        const rows = await query(
            "SELECT * FROM subscriptions WHERE id = ? AND userId = ? LIMIT 1",
            [id, userId]
        );
        const subscription = rows[0];

        if (!subscription) {
            return res.status(404).json({ error: "Subscription not found" });
        }

        // Only allow deletion if payment was never captured
        if (subscription.status !== "PENDING") {
            return res.status(400).json({ error: "Only pending subscriptions can be deleted" });
        }

        // Delete payment first (FK constraint), then subscription
        await execute("DELETE FROM payments WHERE subscriptionId = ?", [id]);
        await execute("DELETE FROM subscriptions WHERE id = ?", [id]);

        res.json({ message: "Pending subscription removed" });
    } catch (error) {
        next(error);
    }
};
