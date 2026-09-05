const mysql = require("mysql2/promise");
require("dotenv/config");

const dbUrl = new URL(process.env.DATABASE_URL);
const pool = mysql.createPool({
  host: dbUrl.hostname,
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ""),
  port: dbUrl.port ? Number(dbUrl.port) : 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

async function runMigration() {
  console.log("Adding new columns to subscription_plans table...");
  
  const columnsToAdd = [
    "ADD COLUMN badge VARCHAR(191) NULL",
    "ADD COLUMN cta VARCHAR(191) NULL",
    "ADD COLUMN icon VARCHAR(191) NULL",
    "ADD COLUMN best TEXT NULL",
    "ADD COLUMN bonus TEXT NULL",
    "ADD COLUMN includes JSON NULL",
    "ADD COLUMN theme TEXT NULL",
    "ADD COLUMN titleColor VARCHAR(191) NULL",
    "ADD COLUMN iconColor VARCHAR(191) NULL",
    "ADD COLUMN dividerColor VARCHAR(191) NULL"
  ];

  // Get existing column names
  const [cols] = await pool.query("SHOW COLUMNS FROM subscription_plans");
  const existingColNames = cols.map(c => c.Field);

  for (const colDef of columnsToAdd) {
    const colName = colDef.split(" ")[2];
    if (!existingColNames.includes(colName)) {
      try {
        await pool.query(`ALTER TABLE subscription_plans ${colDef}`);
        console.log(`Added column: ${colName}`);
      } catch (err) {
        console.error(`Error adding column ${colName}:`, err.message);
      }
    } else {
      console.log(`Column ${colName} already exists.`);
    }
  }

  console.log("\nPopulating existing plans with rich frontend metadata...");

  const planUpdates = [
    {
      id: "trial",
      badge: "New User",
      cta: "Choose Trial Plan",
      icon: "Sprout",
      best: "First-time users who want to try out our salads.",
      bonus: null,
      includes: JSON.stringify([
        "Daily rotating bowl menu",
        "Perfect to test our taste & quality",
        "No skipping meals"
      ]),
      theme: "bg-white text-[#0A472E] border border-[#d0ddd4] hover:border-[#0A472E] hover:shadow-xl transition-all duration-300",
      titleColor: "text-[#0A472E]",
      iconColor: "text-[#0A472E]",
      dividerColor: "border-[#0A472E]/10"
    },
    {
      id: "weekly",
      badge: "Popular",
      cta: "Choose Weekly Plan",
      icon: "Flame",
      best: "Working professionals, gym-goers and healthy eating beginners.",
      bonus: null,
      includes: JSON.stringify([
        "Daily rotating bowl menu",
        "Paneer & Pasta premium bowls included",
        "Skip 1 meal and redeem next Monday"
      ]),
      theme: "bg-[#0A472E] text-white border border-[#C9D909] hover:shadow-xl transition-all duration-300",
      titleColor: "text-white",
      iconColor: "text-[#C9D909]",
      dividerColor: "border-white/10"
    },
    {
      id: "monthly",
      badge: "Premium Membership",
      cta: "Choose Monthly Plan",
      icon: "Crown",
      best: "Fitness-focused customers and long-term healthy eating.",
      bonus: "🎁 First Month Bonus: Get 27 bowls for the price of 26 (1 FREE ETATO Protein Bowl worth ₹249)",
      includes: JSON.stringify([
        "Daily rotating bowl menu",
        "Premium bowls included",
        "Skip up to 3 meals/month",
        "Redeem meals next month (Mon/Tue/Wed)"
      ]),
      theme: "bg-white text-[#0A472E] border border-[#d0ddd4] hover:border-[#C9D909] hover:shadow-xl transition-all duration-300",
      titleColor: "text-[#0A472E]",
      iconColor: "text-[#0A472E]",
      dividerColor: "border-[#0A472E]/10"
    },
    {
      id: "70c0eb28-b444-4601-9196-69a519f2435f", // Monthly Office Plan
      badge: "Office Special",
      cta: "Choose Office Plan",
      icon: "Briefcase",
      best: "Fuel Your Work Week",
      bonus: "💼 Mon to Fri – 20 high protein salads at 4499 Rs (Save 500rs)",
      includes: JSON.stringify([
        "Daily rotating bowl menu",
        "Monday–Friday (20 Bowls)",
        "Skip up to 2 meals/month",
        "Redeem meals next month (1st/2nd)"
      ]),
      theme: "bg-white text-[#0A472E] border border-[#d0ddd4] hover:border-[#C9D909] hover:shadow-xl transition-all duration-300",
      titleColor: "text-[#0A472E]",
      iconColor: "text-[#0A472E]",
      dividerColor: "border-[#0A472E]/10"
    }
  ];

  for (const p of planUpdates) {
    await pool.query(
      `UPDATE subscription_plans
       SET badge = ?, cta = ?, icon = ?, best = ?, bonus = ?, includes = ?, theme = ?, titleColor = ?, iconColor = ?, dividerColor = ?, updatedAt = NOW(3)
       WHERE id = ?`,
      [p.badge, p.cta, p.icon, p.best, p.bonus, p.includes, p.theme, p.titleColor, p.iconColor, p.dividerColor, p.id]
    );
    console.log(`Updated plan metadata for: ${p.id}`);
  }

  console.log("\nMigration and data seeding completed successfully!");
}

runMigration()
  .catch(console.error)
  .finally(() => pool.end());
