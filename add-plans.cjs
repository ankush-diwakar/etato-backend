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

async function addPlans() {
  const plans = [
    {
      id: 'trial',
      name: 'Trial Plan',
      type: 'TRIAL',
      durationDays: 3,
      bowlsCount: 3,
      originalPrice: 74700,
      price: 71000,
      discountPct: 5,
      perBowlPrice: 23700,
      sortOrder: 1
    },
    {
      id: 'weekly',
      name: 'Weekly Plan',
      type: 'WEEKLY',
      durationDays: 6,
      bowlsCount: 6,
      originalPrice: 149400,
      price: 134500,
      discountPct: 10,
      perBowlPrice: 22400,
      sortOrder: 2
    },
    {
      id: 'monthly',
      name: 'Monthly Plan',
      type: 'MONTHLY',
      durationDays: 26,
      bowlsCount: 26,
      originalPrice: 647400,
      price: 517900,
      discountPct: 20,
      perBowlPrice: 19900,
      sortOrder: 3
    }
  ];

  for (const plan of plans) {
    await pool.execute(
      `INSERT INTO subscription_plans
        (id, name, type, durationDays, bowlsCount, originalPrice, price, discountPct, perBowlPrice, isActive, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         type = VALUES(type),
         durationDays = VALUES(durationDays),
         bowlsCount = VALUES(bowlsCount),
         originalPrice = VALUES(originalPrice),
         price = VALUES(price),
         discountPct = VALUES(discountPct),
         perBowlPrice = VALUES(perBowlPrice),
         sortOrder = VALUES(sortOrder),
         updatedAt = NOW(3)`,
      [
        plan.id,
        plan.name,
        plan.type,
        plan.durationDays,
        plan.bowlsCount,
        plan.originalPrice,
        plan.price,
        plan.discountPct,
        plan.perBowlPrice,
        plan.sortOrder,
      ]
    );
    console.log("Added plan:", plan.name);
  }
}

addPlans()
  .catch(console.error)
  .finally(() => pool.end());
