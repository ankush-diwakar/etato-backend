import "dotenv/config";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool, query, execute } from "../src/config/db.js";

function normalizeIngredients(value) {
    if (Array.isArray(value)) {
        return value
            .filter((item) => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    if (typeof value === "string") {
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
}

async function loadSeedSnapshot() {
    try {
        const module = await import("./seed.data.js");
        return module.seedData || null;
    } catch {
        return null;
    }
}

async function insertIgnore(table, rows) {
    if (!rows || rows.length === 0) return;

    for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => "?").join(", ");
        const values = columns.map((key) => row[key]);

        await execute(
            `INSERT IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
        );
    }
}

async function seedFromSnapshot(seedData) {
    const {
        users = [],
        refreshTokens = [],
        addresses = [],
        categories = [],
        menuItems = [],
        coupons = [],
        subscriptionPlans = [],
        subscriptions = [],
        orders = [],
        orderItems = [],
        payments = [],
        contactSubmissions = [],
        blogPosts = [],
        siteSettings = [],
    } = seedData;

    await insertIgnore("users", users);
    await insertIgnore("refresh_tokens", refreshTokens);
    await insertIgnore("addresses", addresses);
    await insertIgnore("categories", categories);
    await insertIgnore(
        "menu_items",
        menuItems.map((item) => ({
            ...item,
            ingredients: JSON.stringify(normalizeIngredients(item.ingredients)),
        }))
    );
    await insertIgnore("coupons", coupons);
    await insertIgnore("subscription_plans", subscriptionPlans);
    await insertIgnore("subscriptions", subscriptions);
    await insertIgnore("orders", orders);
    await insertIgnore("order_items", orderItems);
    await insertIgnore("payments", payments);
    await insertIgnore("contact_submissions", contactSubmissions);
    await insertIgnore("blog_posts", blogPosts);
    await insertIgnore("site_settings", siteSettings);
}

async function main() {
    console.log("🌱 Seeding database...\n");

    const snapshot = await loadSeedSnapshot();
    if (snapshot) {
        console.log("📦 Using prisma/seed.data.js snapshot");
        await seedFromSnapshot(snapshot);
        console.log("✅ Snapshot seed complete\n");
        return;
    }

    // ─── Super Admin ─────────────────────────────────────
    const adminEmail = process.env.SUPER_ADMIN_EMAIL || "etatofoods@gmail.com";
    const adminPass = process.env.SUPER_ADMIN_PASSWORD || "EtatoAdmin@2026";

    const existingAdmin = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [adminEmail]);
    if (existingAdmin.length === 0) {
        await execute(
            `INSERT INTO users
        (id, email, passwordHash, name, phone, emailVerified, phoneVerified, role, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, 1, 'SUPER_ADMIN', 'ACTIVE', NOW(3), NOW(3))`,
            [
                crypto.randomUUID(),
                adminEmail,
                await bcrypt.hash(adminPass, 12),
                "Etato Admin",
                "+917499934425",
            ]
        );
        console.log(`✅ Super admin: ${adminEmail}`);
    } else {
        console.log(`✅ Super admin already exists: ${adminEmail}`);
    }

    // ─── Categories ──────────────────────────────────────
    const categories = [
        { name: "Paneer Bowls", slug: "paneer-bowls", sortOrder: 1 },
        { name: "Sprout Bowls", slug: "sprout-bowls", sortOrder: 2 },
        { name: "Beverages", slug: "beverages", sortOrder: 3 },
    ];

    for (const cat of categories) {
        await execute(
            `INSERT INTO categories (id, name, slug, sortOrder, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         slug = VALUES(slug),
         sortOrder = VALUES(sortOrder),
         updatedAt = NOW(3)`,
            [crypto.randomUUID(), cat.name, cat.slug, cat.sortOrder]
        );
    }
    console.log(`✅ Categories: ${categories.map((c) => c.name).join(", ")}`);

    // ─── Menu Items ──────────────────────────────────────
    const [paneerCat] = await query("SELECT id FROM categories WHERE slug = 'paneer-bowls' LIMIT 1");
    const [sproutCat] = await query("SELECT id FROM categories WHERE slug = 'sprout-bowls' LIMIT 1");
    const [bevCat] = await query("SELECT id FROM categories WHERE slug = 'beverages' LIMIT 1");

    const items = [
        {
            name: "ETATO Paneer Protein Punch Bowl",
            slug: "paneer-punch",
            dressing: "Golden Garlic Cream",
            categoryId: paneerCat?.id,
            protein: "25–30g",
            calories: "400–450",
            carbs: "35–40g",
            fat: "14–18g",
            fiber: "8–10g",
            ingredients: ["paneer", "french beans", "broccoli", "baby corn", "carrot", "zucchini", "capsicum", "onion", "lettuce", "cherry tomato", "black olives", "sesame seeds"],
            price: 249,
            jain: 1,
            status: "ACTIVE",
            isFeatured: 1,
            sortOrder: 1,
        },
        {
            name: "Harvest Wheat Pasta Bowl",
            slug: "harvest-pasta",
            dressing: "Classic Green Dressing",
            categoryId: paneerCat?.id,
            protein: "22–25g",
            calories: "400–420",
            carbs: "45–50g",
            fat: "12–16g",
            fiber: "7–9g",
            ingredients: ["wheat pasta", "paneer", "french beans", "broccoli", "baby corn", "carrot", "zucchini", "capsicum", "cherry tomato", "black olives"],
            price: 249,
            jain: 1,
            status: "ACTIVE",
            isFeatured: 0,
            sortOrder: 2,
        },
        {
            name: "Protein Prunch Sprout Bowl",
            slug: "sprout-punch",
            dressing: "Minty Yoghurt Dip",
            categoryId: sproutCat?.id,
            protein: "22–25g",
            calories: "400–450",
            carbs: "40–45g",
            fat: "10–14g",
            fiber: "10–12g",
            ingredients: ["sprouts", "paneer", "sweet corn", "cucumber", "capsicum", "cherry tomato", "red cabbage", "lettuce", "roasted peanuts", "pumpkin seeds", "pomegranate"],
            price: 249,
            jain: 1,
            status: "ACTIVE",
            isFeatured: 1,
            sortOrder: 1,
        },
        {
            name: "Golden Chickpeas Nourish Bowl",
            slug: "chickpeas",
            dressing: "Classic Green Dressing Dip",
            categoryId: sproutCat?.id,
            protein: "22–25g",
            calories: "400–450",
            carbs: "50–55g",
            fat: "10–12g",
            fiber: "12–14g",
            ingredients: ["chickpeas", "lettuce", "cucumber", "tomato", "black olives", "sweet corn", "broccoli", "onion", "capsicum"],
            price: 249,
            jain: 1,
            status: "ACTIVE",
            isFeatured: 1,
            sortOrder: 2,
        },
        {
            name: "Soya Supreme Bowl",
            slug: "soya-supreme",
            dressing: "Minty Yoghurt Dip",
            categoryId: sproutCat?.id,
            protein: "25–30g",
            calories: "250–300",
            carbs: "40–45g",
            fat: "8–10g",
            fiber: "9–11g",
            ingredients: ["soya chunks", "cabbage", "red cabbage", "carrot", "capsicum", "onion", "tomato", "cherry tomato", "pomegranate", "sesame seeds"],
            price: 249,
            jain: 1,
            status: "ACTIVE",
            isFeatured: 0,
            sortOrder: 3,
        },
        {
            name: "Lemonade",
            slug: "lemonade",
            dressing: "Fresh Lemon · Mint",
            categoryId: bevCat?.id,
            ingredients: ["fresh lemon", "mint", "salt", "sugar", "water"],
            jain: 1,
            status: "COMING_SOON",
            isFeatured: 0,
            sortOrder: 1,
        },
        {
            name: "Watermelon Juice",
            slug: "watermelon",
            dressing: "Watermelon · Mint · Lime",
            categoryId: bevCat?.id,
            ingredients: ["fresh watermelon", "mint", "lemon"],
            jain: 1,
            status: "COMING_SOON",
            isFeatured: 0,
            sortOrder: 2,
        },
    ];

    for (const item of items) {
        await execute(
            `INSERT INTO menu_items
        (id, name, slug, dressing, categoryId, protein, calories, carbs, fat, fiber, ingredients, price, jain, status, isFeatured, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         dressing = VALUES(dressing),
         categoryId = VALUES(categoryId),
         protein = VALUES(protein),
         calories = VALUES(calories),
         carbs = VALUES(carbs),
         fat = VALUES(fat),
         fiber = VALUES(fiber),
         ingredients = VALUES(ingredients),
         price = VALUES(price),
         jain = VALUES(jain),
         status = VALUES(status),
         isFeatured = VALUES(isFeatured),
         sortOrder = VALUES(sortOrder),
         updatedAt = NOW(3)`,
            [
                crypto.randomUUID(),
                item.name,
                item.slug,
                item.dressing,
                item.categoryId,
                item.protein || null,
                item.calories || null,
                item.carbs || null,
                item.fat || null,
                item.fiber || null,
                JSON.stringify(item.ingredients),
                item.price ?? null,
                item.jain ? 1 : 0,
                item.status,
                item.isFeatured ? 1 : 0,
                item.sortOrder ?? 0,
            ]
        );
    }
    console.log(`✅ Menu items: ${items.length} items seeded`);

    // ─── Coupon ──────────────────────────────────────────
    await execute(
        `INSERT INTO coupons (id, code, discountPct, maxUses, isActive, createdAt)
     VALUES (?, ?, ?, ?, 1, NOW(3))
     ON DUPLICATE KEY UPDATE
       discountPct = VALUES(discountPct),
       maxUses = VALUES(maxUses),
       isActive = VALUES(isActive)`,
        [crypto.randomUUID(), "ETATO10", 10, 50]
    );
    console.log("✅ Coupon: ETATO10 (10% off, first 50 customers)");

    console.log("\n🌿 Seed complete!\n");
}

main()
    .catch((e) => {
        console.error("❌ Seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await pool.end();
    });
