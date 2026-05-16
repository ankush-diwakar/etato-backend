const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    await prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan
    });
    console.log('Added plan:', plan.name);
  }
}

addPlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
