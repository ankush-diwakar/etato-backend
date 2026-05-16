import express from "express";
import {
    getPlans,
    createSubscription,
    verifySubscriptionPayment,
    getUserSubscriptions,
    getSubscriptionDetail
} from "../controllers/subscription.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public
router.get("/plans", getPlans);

// Protected
router.use(authenticate);
router.post("/", createSubscription);
router.post("/verify", verifySubscriptionPayment);
router.get("/", getUserSubscriptions);
router.get("/:id", getSubscriptionDetail);

export default router;
