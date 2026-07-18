import cron from "node-cron";
import { execute } from "../config/db.js";

export async function runAutoExpireSubscriptions() {
  console.log("[Job] Running auto-expire subscriptions...");
  try {
    const result = await execute(`
      UPDATE subscriptions s
      JOIN subscription_plans p ON s.planId = p.id
      SET s.status = 'EXPIRED', s.updatedAt = NOW(3)
      WHERE s.status = 'ACTIVE' 
        AND DATE_ADD(s.startDate, INTERVAL p.durationDays DAY) < NOW()
    `);
    
    console.log(`[Job] Auto-expire completed. Rows affected: ${result?.affectedRows ?? 0}`);
  } catch (error) {
    console.error("[Job] Error auto-expiring subscriptions:", error);
  }
}

export function startSubscriptionJobs() {
  // Run every day at midnight (0 0 * * *)
  cron.schedule("0 0 * * *", () => {
    runAutoExpireSubscriptions();
  });

  console.log("[Cron] Subscription auto-expire job scheduled.");
}
