import transporter from "../config/mail.js";
import { env } from "../config/env.js";
import { query } from "../config/db.js";

export async function getAdminEmails() {
  try {
    const rows = await query(
      "SELECT email FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'"
    );
    const emails = rows
      .map((r) => r.email?.trim())
      .filter((e) => typeof e === "string" && e.length > 0);

    if (env.SUPER_ADMIN_EMAIL && !emails.includes(env.SUPER_ADMIN_EMAIL.trim())) {
      emails.push(env.SUPER_ADMIN_EMAIL.trim());
    }

    return [...new Set(emails)];
  } catch (err) {
    console.error("❌ Failed to query admin emails:", err.message);
    return env.SUPER_ADMIN_EMAIL ? [env.SUPER_ADMIN_EMAIL.trim()] : [];
  }
}

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

  const adminEmails = await getAdminEmails();
  for (const email of adminEmails) {
    await sendMail(email, `New contact: ${submission.subject} from ${submission.name}`, html);
  }
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

export async function sendSubscriptionAdminAlert(payload) {
  const adminEmails = await getAdminEmails();
  if (!adminEmails || adminEmails.length === 0) {
    console.warn("⚠️ No admin emails found to send subscription alert.");
    return;
  }

  // Support both new { subscription, user, plan, payment, address } and legacy flat payload
  const subscription = payload?.subscription || payload;
  const user = payload?.user || subscription?.user || {};
  const plan = payload?.plan || subscription?.plan || {};
  const payment = payload?.payment || {};
  const address = payload?.address || null;

  const amountInRupees = payment?.amount
    ? (payment.amount / 100).toFixed(2)
    : Number(plan?.price || subscription?.price || 0).toFixed(2);

  const paidAtFormatted = payment?.paidAt
    ? new Date(payment.paidAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

  const startDateFormatted = subscription?.startDate
    ? new Date(subscription.startDate).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Immediate";

  const endDateFormatted = subscription?.endDate
    ? new Date(subscription.endDate).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Ongoing";

  const slotLabel =
    subscription?.deliverySlot === "LUNCH"
      ? "Lunch · 12:00 PM – 2:30 PM"
      : subscription?.deliverySlot === "DINNER"
      ? "Dinner · 7:00 PM – 9:30 PM"
      : subscription?.deliverySlot || "Standard Delivery";

  const dietBadge =
    subscription?.dietaryPref === "JAIN"
      ? `<span style="background: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid #FCD34D;">🙏 Jain (No Onion / Garlic)</span>`
      : `<span style="background: #E8F5E9; color: #166534; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid #BBF7D0;">🌱 Regular Veg</span>`;

  const rawPhone = user?.phone ? String(user.phone).replace(/\D/g, "") : "";
  const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

  const planBadgeHtml = plan?.badge
    ? `<span style="display: inline-block; background-color: #C9D909; color: #0A472E; font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 20px; margin-left: 8px; text-transform: uppercase;">${plan.badge}</span>`
    : "";

  const durationDays = plan?.durationDays || subscription?.durationDays || 0;
  const bowlsCount = plan?.bowlsCount || subscription?.bowlsCount || 0;
  const perBowlPrice = plan?.perBowlPrice || (plan?.price && bowlsCount ? Math.round(plan.price / bowlsCount) : 0);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Subscription: ${plan?.name || "Meal Plan"}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F0F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F0F4F2; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); border: 1px solid #E2E8F0;">
          
          <!-- Branded Hero Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A472E 0%, #165B3D 100%); padding: 32px 28px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <span style="display: inline-block; background-color: #C9D909; color: #0A472E; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 14px; border-radius: 50px;">
                      ⚡ NEW SUBSCRIPTION ACTIVATED
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
                      🌿 New Subscriber Onboarded!
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.9); font-size: 15px; margin: 8px 0 0 0; font-weight: 500;">
                      Plan: <strong style="color: #C9D909;">${plan?.name || "Healthy Meal Plan"}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 24px;">

              <!-- Hero Payment Highlight Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F7FBF8; border: 2px solid #86EFAC; border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #166534; letter-spacing: 0.08em; margin-bottom: 4px;">
                            Total Amount Paid
                          </div>
                          <div style="font-size: 32px; font-weight: 900; color: #0A472E; line-height: 1.1;">
                            ₹${amountInRupees}
                          </div>
                        </td>
                        <td align="right" style="vertical-align: top;">
                          <span style="display: inline-block; background-color: #166534; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.05em; text-transform: uppercase;">
                            ✓ ${payment?.status || "CAPTURED"}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <div style="border-top: 1px solid #DCFCE7; margin-top: 16px; padding-top: 14px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Razorpay Payment ID:</td>
                          <td align="right" style="padding: 4px 0; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 12px; font-weight: 700; color: #1F2937;">
                            ${payment?.razorpayPaymentId || "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Razorpay Order ID:</td>
                          <td align="right" style="padding: 4px 0; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 12px; font-weight: 700; color: #1F2937;">
                            ${payment?.razorpayOrderId || "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Subscription ID:</td>
                          <td align="right" style="padding: 4px 0; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 12px; font-weight: 700; color: #0A472E;">
                            ${subscription?.id ? subscription.id.slice(0, 16) + '...' : "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Paid At:</td>
                          <td align="right" style="padding: 4px 0; color: #1F2937; font-weight: 600;">
                            ${paidAtFormatted}
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Subscription Plan Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0A472E; letter-spacing: 0.08em;">
                      📦 Subscription Plan Details
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; font-size: 14px;">
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; width: 34%; border-bottom: 1px solid #E5E7EB;">
                          Selected Plan
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #0A472E; font-size: 15px; border-bottom: 1px solid #E5E7EB;">
                          ${plan?.name || "Meal Plan"}${planBadgeHtml}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Duration & Bowls
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          🗓️ ${durationDays} Days · 🥗 ${bowlsCount} High-Protein Bowls (${perBowlPrice ? `₹${perBowlPrice}/bowl` : ""})
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Schedule Window
                        </td>
                        <td style="padding: 12px 16px; color: #111827; font-weight: 600; border-bottom: 1px solid #E5E7EB;">
                          📅 ${startDateFormatted} → ${endDateFormatted}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Delivery Slot
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          ⏰ ${slotLabel}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Dietary Preference
                        </td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid #E5E7EB;">
                          ${dietBadge}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; ${subscription?.specialNotes ? 'border-bottom: 1px solid #E5E7EB;' : ''}">
                          Bowl Preference
                        </td>
                        <td style="padding: 12px 16px; color: #111827; font-weight: 600; ${subscription?.specialNotes ? 'border-bottom: 1px solid #E5E7EB;' : ''}">
                          🥣 ${subscription?.bowlPreference || "Daily Rotating Menu"}
                        </td>
                      </tr>
                      ${
                        subscription?.specialNotes
                          ? `
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #B45309; background: #FFFBEB;">
                          Special Notes
                        </td>
                        <td style="padding: 12px 16px; color: #92400E; background: #FFFBEB; font-weight: 600;">
                          📝 ${subscription.specialNotes}
                        </td>
                      </tr>
                      `
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Customer & Delivery Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0A472E; letter-spacing: 0.08em;">
                      👤 Customer & Delivery Details
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; font-size: 14px;">
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; width: 34%; border-bottom: 1px solid #E5E7EB;">
                          Subscriber Name
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          ${user?.name || "Subscriber"}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Phone Number
                        </td>
                        <td style="padding: 12px 16px; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          ${
                            user?.phone
                              ? `<a href="tel:${user.phone}" style="color: #0A472E; font-weight: 700; text-decoration: none;">📞 ${user.phone}</a>`
                              : "<span style='color: #9CA3AF;'>Not provided</span>"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Email Address
                        </td>
                        <td style="padding: 12px 16px; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          <a href="mailto:${user?.email}" style="color: #0A472E; font-weight: 600; text-decoration: none;">✉️ ${user?.email || "N/A"}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280;">
                          Delivery Address
                        </td>
                        <td style="padding: 12px 16px; color: #111827; line-height: 1.4;">
                          📍 ${address?.label ? `<strong style="color: #0A472E;">${address.label}:</strong> ` : ""}${address?.fullAddress || "Address on record in customer profile"}${address?.pinCode ? ` · <strong>PIN: ${address.pinCode}</strong>` : ""}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Buttons -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 10px;">
                    <a href="${env.CLIENT_URL}/admin/subscriptions" target="_blank" style="display: inline-block; background-color: #0A472E; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; box-shadow: 0 4px 14px rgba(10, 71, 46, 0.3);">
                      View Subscriptions in Admin Dashboard →
                    </a>
                  </td>
                </tr>
                ${
                  cleanPhone
                    ? `
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <a href="https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(user?.name || '')}%2C%20welcome%20to%20Etato%20Foods!%20Your%20${encodeURIComponent(plan?.name || 'Meal')}%20subscription%20is%20now%20active.%20🌿" target="_blank" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-size: 13px; font-weight: 700; text-decoration: none; padding: 9px 22px; border-radius: 50px;">
                      💬 Send WhatsApp Onboarding Welcome
                    </a>
                  </td>
                </tr>
                `
                    : ""
                }
                <tr>
                  <td align="center">
                    <p style="font-size: 12px; color: #9CA3AF; margin: 8px 0 0 0;">
                      Manage subscriber schedule, pauses, and renewals directly from the admin panel.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.5;">
                🌿 <strong>Etato Foods Cloud Kitchen</strong> · Automated Subscription Dispatch Service<br>
                This notification is sent to all registered Super Admins.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = `🎉 [New Subscription] ${plan?.name || "Meal Plan"} · ${user?.name || "Customer"} · ₹${amountInRupees} received`;

  for (const email of adminEmails) {
    await sendMail(email, subject, html);
  }
}

export async function sendOrderPaymentAdminAlert({ order, payment, user, address, items = [] }) {
  const adminEmails = await getAdminEmails();
  if (!adminEmails || adminEmails.length === 0) {
    console.warn("⚠️ No admin emails found to send order payment alert.");
    return;
  }

  const amountInRupees = payment?.amount
    ? (payment.amount / 100).toFixed(2)
    : Number(order.total || 0).toFixed(2);

  const paidAtFormatted = payment?.paidAt
    ? new Date(payment.paidAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

  const slotLabel =
    order.deliverySlot === "LUNCH"
      ? "Lunch · 12:00 PM – 2:30 PM"
      : order.deliverySlot === "DINNER"
      ? "Dinner · 7:00 PM – 9:30 PM"
      : order.deliverySlot || "Standard Delivery";

  const dietBadge =
    order.dietaryPref === "JAIN"
      ? `<span style="background: #FEF3C7; color: #92400E; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid #FCD34D;">🙏 Jain (No Onion / Garlic)</span>`
      : `<span style="background: #E8F5E9; color: #166534; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid #BBF7D0;">🌱 Regular Veg</span>`;

  const itemsRowsHtml = items
    .map(
      (item, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB"};">
        <td style="padding: 12px 14px; border-bottom: 1px solid #E5E7EB; vertical-align: middle;">
          <div style="font-weight: 700; color: #111827; font-size: 14px;">${item.menuItemName || "Salad Bowl"}</div>
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #E5E7EB; text-align: center; vertical-align: middle;">
          <span style="display: inline-block; background: #0A472E; color: #FFFFFF; font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 12px;">${item.quantity}x</span>
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #4B5563; font-size: 13px; vertical-align: middle;">
          ₹${item.unitPrice}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: 700; color: #0A472E; font-size: 14px; vertical-align: middle;">
          ₹${item.total}
        </td>
      </tr>
    `
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order #${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F0F4F2; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1F2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F0F4F2; padding: 30px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08); border: 1px solid #E2E8F0;">
          
          <!-- Branded Hero Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0A472E 0%, #165B3D 100%); padding: 32px 28px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <span style="display: inline-block; background-color: #C9D909; color: #0A472E; font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 5px 14px; border-radius: 50px;">
                      ⚡ PAYMENT VERIFIED & CAPTURED
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.02em;">
                      🌿 New Order Received!
                    </h1>
                    <p style="color: rgba(255, 255, 255, 0.9); font-size: 15px; margin: 8px 0 0 0; font-weight: 500;">
                      Order ID: <strong style="color: #C9D909; letter-spacing: 0.05em;">#${order.orderNumber}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 24px;">

              <!-- Hero Payment Highlight Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F7FBF8; border: 2px solid #86EFAC; border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="vertical-align: top;">
                          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #166534; letter-spacing: 0.08em; margin-bottom: 4px;">
                            Total Amount Paid
                          </div>
                          <div style="font-size: 32px; font-weight: 900; color: #0A472E; line-height: 1.1;">
                            ₹${amountInRupees}
                          </div>
                        </td>
                        <td align="right" style="vertical-align: top;">
                          <span style="display: inline-block; background-color: #166534; color: #FFFFFF; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.05em; text-transform: uppercase;">
                            ✓ ${payment?.status || "CAPTURED"}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <div style="border-top: 1px solid #DCFCE7; margin-top: 16px; padding-top: 14px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Razorpay Payment ID:</td>
                          <td align="right" style="padding: 4px 0; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 12px; font-weight: 700; color: #1F2937;">
                            ${payment?.razorpayPaymentId || "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Razorpay Order ID:</td>
                          <td align="right" style="padding: 4px 0; font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 12px; font-weight: 700; color: #1F2937;">
                            ${payment?.razorpayOrderId || "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #6B7280; font-weight: 500;">Paid At:</td>
                          <td align="right" style="padding: 4px 0; color: #1F2937; font-weight: 600;">
                            ${paidAtFormatted}
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Customer & Delivery Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0A472E; letter-spacing: 0.08em;">
                      👤 Customer & Delivery Details
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; font-size: 14px;">
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; width: 34%; border-bottom: 1px solid #E5E7EB;">
                          Customer Name
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          ${user?.name || "Customer"}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Phone Number
                        </td>
                        <td style="padding: 12px 16px; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          ${
                            user?.phone
                              ? `<a href="tel:${user.phone}" style="color: #0A472E; font-weight: 700; text-decoration: none;">📞 ${user.phone}</a>`
                              : "<span style='color: #9CA3AF;'>Not provided</span>"
                          }
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Email Address
                        </td>
                        <td style="padding: 12px 16px; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          <a href="mailto:${user?.email}" style="color: #0A472E; font-weight: 600; text-decoration: none;">✉️ ${user?.email || "N/A"}</a>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Delivery Address
                        </td>
                        <td style="padding: 12px 16px; color: #111827; line-height: 1.4; border-bottom: 1px solid #E5E7EB;">
                          📍 ${address?.label ? `<strong style="color: #0A472E;">${address.label}:</strong> ` : ""}${address?.fullAddress || "Address details on record"}${address?.pinCode ? ` · <strong>PIN: ${address.pinCode}</strong>` : ""}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280; border-bottom: 1px solid #E5E7EB;">
                          Delivery Slot
                        </td>
                        <td style="padding: 12px 16px; font-weight: 700; color: #111827; border-bottom: 1px solid #E5E7EB;">
                          ⏰ ${slotLabel}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #6B7280;">
                          Dietary Preference
                        </td>
                        <td style="padding: 12px 16px;">
                          ${dietBadge}
                        </td>
                      </tr>
                      ${
                        order.specialNotes
                          ? `
                      <tr>
                        <td style="padding: 12px 16px; font-weight: 600; color: #B45309; background: #FFFBEB; border-top: 1px solid #FCD34D;">
                          Special Notes
                        </td>
                        <td style="padding: 12px 16px; color: #92400E; background: #FFFBEB; font-weight: 600; border-top: 1px solid #FCD34D;">
                          📝 ${order.specialNotes}
                        </td>
                      </tr>
                      `
                          : ""
                      }
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Order Items Section -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0A472E; letter-spacing: 0.08em;">
                      🥗 Ordered Items
                    </div>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden;">
                      <thead>
                        <tr style="background: #F3F4F6;">
                          <th style="padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.05em;">Item</th>
                          <th style="padding: 10px 14px; text-align: center; font-size: 11px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.05em;">Qty</th>
                          <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.05em;">Price</th>
                          <th style="padding: 10px 14px; text-align: right; font-size: 11px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.05em;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemsRowsHtml || `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #6B7280;">No items found</td></tr>`}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Bill Totals Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px;">
                      <tr>
                        <td style="padding: 4px 0; color: #4B5563; font-weight: 500;">Subtotal</td>
                        <td align="right" style="padding: 4px 0; font-weight: 600; color: #111827;">₹${order.subtotal || order.total}</td>
                      </tr>
                      ${
                        order.discount > 0
                          ? `
                      <tr>
                        <td style="padding: 4px 0; color: #166534; font-weight: 600;">
                          🏷️ Discount (${order.couponCode || "Coupon"})
                        </td>
                        <td align="right" style="padding: 4px 0; font-weight: 700; color: #166534;">
                          -₹${order.discount}
                        </td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td style="padding: 4px 0; color: #4B5563; font-weight: 500;">Delivery Fee</td>
                        <td align="right" style="padding: 4px 0; font-weight: 600; color: ${order.deliveryCharge > 0 ? "#111827" : "#166534"};">
                          ${order.deliveryCharge > 0 ? `₹${order.deliveryCharge}` : "FREE"}
                        </td>
                      </tr>
                      <tr>
                        <td colspan="2" style="border-top: 1px solid #E5E7EB; padding-top: 10px; margin-top: 10px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td style="font-size: 16px; font-weight: 800; color: #111827;">
                                Grand Total Paid
                              </td>
                              <td align="right" style="font-size: 20px; font-weight: 900; color: #0A472E;">
                                ₹${amountInRupees}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom: 8px;">
                    <a href="${env.CLIENT_URL}/admin/orders" target="_blank" style="display: inline-block; background-color: #0A472E; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 50px; box-shadow: 0 4px 14px rgba(10, 71, 46, 0.3);">
                      View Order in Admin Dashboard →
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="font-size: 12px; color: #9CA3AF; margin: 8px 0 0 0;">
                      Clicking above will open the orders management screen directly.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F9FAFB; padding: 20px; text-align: center; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 12px; color: #6B7280; line-height: 1.5;">
                🌿 <strong>Etato Foods Cloud Kitchen</strong> · Automated Order Dispatch Service<br>
                This notification is sent to all registered Super Admins.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const subject = `💰 [Payment Verified] New Order #${order.orderNumber} · ₹${amountInRupees} received`;

  for (const email of adminEmails) {
    await sendMail(email, subject, html);
  }
}


