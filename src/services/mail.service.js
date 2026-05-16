import transporter from "../config/mail.js";
import { env } from "../config/env.js";

async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
  }
}

export async function sendWelcomeEmail(user) {
  const html = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAFAF7; border-radius: 16px; overflow: hidden;">
      <div style="background: #1B4332; padding: 32px; text-align: center;">
        <h1 style="color: #FAFAF7; font-size: 28px; margin: 0;">🌿 Welcome to Etato Foods!</h1>
      </div>
      <div style="padding: 32px;">
        <p style="font-size: 16px; color: #3D3D3D; line-height: 1.6;">
          Hi <strong>${user.name}</strong>,
        </p>
        <p style="font-size: 16px; color: #3D3D3D; line-height: 1.6;">
          Welcome to the Etato family! 🎉 You've joined Pune's healthiest cloud kitchen.
        </p>
        <div style="background: #D8F3DC; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #1B4332;">✅ 22–30g protein in every bowl</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #1B4332;">✅ 100% Pure Veg — Jain options on every item</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #1B4332;">✅ Fresh vegetables sourced daily — nothing frozen</p>
          <p style="margin: 0; font-size: 14px; color: #1B4332;">✅ Delivery Mon–Sat in Katraj & nearby areas</p>
        </div>
        <div style="background: #FFFBE6; border: 2px solid #7A6019; border-radius: 12px; padding: 16px; text-align: center; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; color: #7A6019;">🎁 LAUNCH OFFER</p>
          <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: bold; color: #7A6019;">
            Use code <span style="letter-spacing: 2px;">ETATO10</span> for 10% off!
          </p>
        </div>
        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="${env.CLIENT_URL}/menu" style="background: #1B4332; color: #FAFAF7; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
            View Our Menu
          </a>
        </div>
        <p style="font-size: 13px; color: #888; text-align: center; margin-top: 24px;">
          Choose. Better. Today.<br/>— Team Etato 🌿
        </p>
      </div>
    </div>
  `;

  await sendMail(user.email, `Welcome to Etato Foods, ${user.name}! 🌿`, html);
}

export async function sendContactNotification(submission) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1B4332;">New Contact Form Submission</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Name</td><td style="padding: 8px;">${submission.name}</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Email</td><td style="padding: 8px;">${submission.email}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Phone</td><td style="padding: 8px;">${submission.phone}</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Subject</td><td style="padding: 8px;">${submission.subject}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Message</td><td style="padding: 8px;">${submission.message}</td></tr>
      </table>
      <p style="font-size: 12px; color: #888; margin-top: 16px;">Received at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
    </div>
  `;

  await sendMail(env.SUPER_ADMIN_EMAIL, `New contact: ${submission.subject} from ${submission.name}`, html);
}

export async function sendContactAutoReply(submission) {
  const html = `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FAFAF7; border-radius: 16px; overflow: hidden;">
      <div style="background: #1B4332; padding: 24px; text-align: center;">
        <h1 style="color: #FAFAF7; font-size: 22px; margin: 0;">We got your message! 🌿</h1>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 15px; color: #3D3D3D; line-height: 1.6;">
          Hi <strong>${submission.name}</strong>,
        </p>
        <p style="font-size: 15px; color: #3D3D3D; line-height: 1.6;">
          Thank you for reaching out. We'll get back to you on WhatsApp within a few hours during our operating hours (Mon–Sat, 9 AM – 9 PM).
        </p>
        <p style="font-size: 13px; color: #888; margin-top: 24px;">
          — Team Etato Foods<br/>+91 74999 34425 · etatofoods@gmail.com
        </p>
      </div>
    </div>
  `;

  await sendMail(submission.email, `We got your message, ${submission.name}!`, html);
}

export async function sendSubscriptionAdminAlert(subscription) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1B4332;">New Subscription Alert</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Customer</td><td style="padding: 8px;">${subscription.user?.name} (${subscription.user?.phone})</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Plan</td><td style="padding: 8px;">${subscription.plan?.name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Start Date</td><td style="padding: 8px;">${new Date(subscription.startDate).toLocaleDateString()}</td></tr>
        <tr style="background: #f5f5f5;"><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Slot</td><td style="padding: 8px;">${subscription.deliverySlot}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold; color: #3D3D3D;">Bowl Pref</td><td style="padding: 8px;">${subscription.bowlPreference || "Surprise me"}</td></tr>
      </table>
    </div>
  `;
  await sendMail(env.SUPER_ADMIN_EMAIL, `New Subscription: ${subscription.plan?.name} for ${subscription.user?.name}`, html);
}
