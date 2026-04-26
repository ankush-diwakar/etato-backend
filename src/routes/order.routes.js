import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as orderController from "../controllers/order.controller.js";

const router = Router();

router.use(authenticate);

router.post("/", orderController.createOrder);
router.post("/verify-payment", orderController.verifyPayment);
router.get("/", orderController.getUserOrders);

export default router;
