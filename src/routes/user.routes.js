import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import {
  updatePhone,
  updateProfile,
  addAddress,
  getAddresses,
  deleteAddress,
  checkDeliveryZone,
} from "../controllers/user.controller.js";

const router = Router();

const phoneSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid Indian phone number"),
});

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const addressSchema = z.object({
  label: z.string().optional().default("Home"),
  fullAddress: z.string().min(10, "Address is too short"),
  pinCode: z.string().regex(/^\d{6}$/, "PIN code must be 6 digits"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const zoneCheckSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

router.patch("/phone", authenticate, validate(phoneSchema), updatePhone);
router.patch("/profile", authenticate, validate(profileSchema), updateProfile);
router.post("/address", authenticate, validate(addressSchema), addAddress);
router.get("/addresses", authenticate, getAddresses);
router.delete("/address/:id", authenticate, deleteAddress);
router.post("/check-zone", validate(zoneCheckSchema), checkDeliveryZone);

export default router;
