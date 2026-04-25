import nodemailer from "nodemailer";
import { env } from "./env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

// Verify on startup (non-blocking)
transporter.verify().then(() => {
  console.log("📧 Mail transporter ready");
}).catch((err) => {
  console.warn("⚠️  Mail transporter not configured:", err.message);
});

export default transporter;
