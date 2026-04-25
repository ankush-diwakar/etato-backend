import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Super Admin ─────────────────────────────────────
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || "etatofoods@gmail.com";
  const adminPass = process.env.SUPER_ADMIN_PASSWORD || "EtatoAdmin@2026";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Etato Admin",
      passwordHash: await bcrypt.hash(adminPass, 12),
      role: "SUPER_ADMIN",
      phone: "+917499934425",
      emailVerified: true,
      phoneVerified: true,
    },
  });
  console.log(`✅ Super admin: ${admin.email}`);

  // ─── Categories ──────────────────────────────────────
  const categories = [
    { name: "Paneer Bowls", slug: "paneer-bowls", sortOrder: 1 },
    { name: "Sprout Bowls", slug: "sprout-bowls", sortOrder: 2 },
    { name: "Beverages", slug: "beverages", sortOrder: 3 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ Categories: ${categories.map((c) => c.name).join(", ")}`);

  // ─── Menu Items ──────────────────────────────────────
  const paneerCat = await prisma.category.findUnique({ where: { slug: "paneer-bowls" } });
  const sproutCat = await prisma.category.findUnique({ where: { slug: "sprout-bowls" } });
  const bevCat = await prisma.category.findUnique({ where: { slug: "beverages" } });

  const items = [
    {
      name: "ETATO Paneer Protein Punch Bowl",
      slug: "paneer-punch",
      dressing: "Golden Garlic Cream",
      categoryId: paneerCat.id,
      protein: "25–30g", calories: "400–450", carbs: "35–40g", fat: "14–18g", fiber: "8–10g",
      ingredients: ["paneer", "french beans", "broccoli", "baby corn", "carrot", "zucchini", "capsicum", "onion", "lettuce", "cherry tomato", "black olives", "sesame seeds"],
      price: 24900, jain: true, status: "ACTIVE", isFeatured: true, sortOrder: 1,
    },
    {
      name: "Harvest Wheat Pasta Bowl",
      slug: "harvest-pasta",
      dressing: "Classic Green Dressing",
      categoryId: paneerCat.id,
      protein: "22–25g", calories: "400–420", carbs: "45–50g", fat: "12–16g", fiber: "7–9g",
      ingredients: ["wheat pasta", "paneer", "french beans", "broccoli", "baby corn", "carrot", "zucchini", "capsicum", "cherry tomato", "black olives"],
      price: 24900, jain: true, status: "ACTIVE", sortOrder: 2,
    },
    {
      name: "Protein Prunch Sprout Bowl",
      slug: "sprout-punch",
      dressing: "Minty Yoghurt Dip",
      categoryId: sproutCat.id,
      protein: "22–25g", calories: "400–450", carbs: "40–45g", fat: "10–14g", fiber: "10–12g",
      ingredients: ["sprouts", "paneer", "sweet corn", "cucumber", "capsicum", "cherry tomato", "red cabbage", "lettuce", "roasted peanuts", "pumpkin seeds", "pomegranate"],
      price: 24900, jain: true, status: "ACTIVE", isFeatured: true, sortOrder: 1,
    },
    {
      name: "Golden Chickpeas Nourish Bowl",
      slug: "chickpeas",
      dressing: "Classic Green Dressing Dip",
      categoryId: sproutCat.id,
      protein: "22–25g", calories: "400–450", carbs: "50–55g", fat: "10–12g", fiber: "12–14g",
      ingredients: ["chickpeas", "lettuce", "cucumber", "tomato", "black olives", "sweet corn", "broccoli", "onion", "capsicum"],
      price: 24900, jain: true, status: "ACTIVE", isFeatured: true, sortOrder: 2,
    },
    {
      name: "Soya Supreme Bowl",
      slug: "soya-supreme",
      dressing: "Minty Yoghurt Dip",
      categoryId: sproutCat.id,
      protein: "25–30g", calories: "250–300", carbs: "40–45g", fat: "8–10g", fiber: "9–11g",
      ingredients: ["soya chunks", "cabbage", "red cabbage", "carrot", "capsicum", "onion", "tomato", "cherry tomato", "pomegranate", "sesame seeds"],
      price: 24900, jain: true, status: "ACTIVE", sortOrder: 3,
    },
    {
      name: "Lemonade",
      slug: "lemonade",
      dressing: "Fresh Lemon · Mint",
      categoryId: bevCat.id,
      ingredients: ["fresh lemon", "mint", "salt", "sugar", "water"],
      jain: true, status: "COMING_SOON", sortOrder: 1,
    },
    {
      name: "Watermelon Juice",
      slug: "watermelon",
      dressing: "Watermelon · Mint · Lime",
      categoryId: bevCat.id,
      ingredients: ["fresh watermelon", "mint", "lemon"],
      jain: true, status: "COMING_SOON", sortOrder: 2,
    },
  ];

  for (const item of items) {
    await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {},
      create: item,
    });
  }
  console.log(`✅ Menu items: ${items.length} items seeded`);

  // ─── Coupon ──────────────────────────────────────────
  await prisma.coupon.upsert({
    where: { code: "ETATO10" },
    update: {},
    create: {
      code: "ETATO10",
      discountPct: 10,
      maxUses: 50,
      isActive: true,
    },
  });
  console.log("✅ Coupon: ETATO10 (10% off, first 50 customers)");

  console.log("\n🌿 Seed complete!\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
