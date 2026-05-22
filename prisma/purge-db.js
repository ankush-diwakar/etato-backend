import "dotenv/config";
import { pool, query, withTransaction } from "../src/config/db.js";

const ADMIN_EMAIL = "etatofoods@gmail.com";

async function main() {
    console.log("🧹 Purging database data...");

    const adminRows = await query("SELECT id, email FROM users WHERE email = ? LIMIT 1", [ADMIN_EMAIL]);
    const adminUser = adminRows[0];

    if (!adminUser) {
        console.log(`⚠️  Admin user not found for ${ADMIN_EMAIL}.`);
        console.log("⚠️  All users except that email will be deleted.");
    }

    await withTransaction(async (conn) => {
        await conn.execute("DELETE FROM order_items");
        await conn.execute("DELETE FROM payments");
        await conn.execute("DELETE FROM orders");
        await conn.execute("DELETE FROM subscriptions");
        await conn.execute("DELETE FROM addresses");
        await conn.execute("DELETE FROM refresh_tokens");
        await conn.execute("DELETE FROM coupons");
        await conn.execute("DELETE FROM contact_submissions");
        await conn.execute("DELETE FROM site_settings");
        await conn.execute("DELETE FROM users WHERE email <> ?", [ADMIN_EMAIL]);
    });

    console.log("✅ Purge complete.");
    console.log(
        "✅ Kept: subscription_plans, blog_posts, categories, menu_items, and user etatofoods@gmail.com (if present)."
    );
}

main()
    .catch((error) => {
        console.error("❌ Purge failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
