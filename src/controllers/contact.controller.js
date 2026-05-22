import crypto from "crypto";
import { execute, query } from "../config/db.js";
import { sendContactNotification, sendContactAutoReply } from "../services/mail.service.js";

export async function submitContact(req, res) {
  const { name, phone, email, subject, message } = req.validated;

  const id = crypto.randomUUID();
  await execute(
    "INSERT INTO contact_submissions (id, name, phone, email, subject, message, createdAt) VALUES (?, ?, ?, ?, ?, ?, NOW(3))",
    [id, name, phone, email, subject, message]
  );
  const rows = await query("SELECT * FROM contact_submissions WHERE id = ? LIMIT 1", [id]);
  const submission = rows[0];

  // Send emails (non-blocking)
  sendContactNotification(submission).catch(() => { });
  sendContactAutoReply(submission).catch(() => { });

  res.status(201).json({ message: "Thank you! We'll get back to you shortly." });
}
