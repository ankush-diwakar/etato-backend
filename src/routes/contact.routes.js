import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { submitContact } from "../controllers/contact.controller.js";

const router = Router();

const contactSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email("Invalid email"),
  subject: z.enum(["GENERAL_ENQUIRY", "SUBSCRIPTION", "BULK_ORDER", "FEEDBACK", "OTHER"]),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

router.post("/", validate(contactSchema), submitContact);

export default router;
