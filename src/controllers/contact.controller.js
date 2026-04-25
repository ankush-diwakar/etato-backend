import prisma from "../config/db.js";
import { sendContactNotification, sendContactAutoReply } from "../services/mail.service.js";

export async function submitContact(req, res) {
  const { name, phone, email, subject, message } = req.validated;

  const submission = await prisma.contactSubmission.create({
    data: { name, phone, email, subject, message },
  });

  // Send emails (non-blocking)
  sendContactNotification(submission).catch(() => {});
  sendContactAutoReply(submission).catch(() => {});

  res.status(201).json({ message: "Thank you! We'll get back to you shortly." });
}
