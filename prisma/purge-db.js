import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "etatofoods@gmail.com";

async function main() {
    console.log("🧹 Purging database data...");

    const adminUser = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL },
        select: { id: true, email: true },
    });

    if (!adminUser) {
        console.log(`⚠️  Admin user not found for ${ADMIN_EMAIL}.`);
        console.log("⚠️  All users except that email will be deleted.");
    }

    await prisma.$transaction([
        prisma.orderItem.deleteMany(),
        prisma.payment.deleteMany(),
        prisma.order.deleteMany(),
        prisma.subscription.deleteMany(),
        prisma.address.deleteMany(),
        prisma.refreshToken.deleteMany(),
        prisma.coupon.deleteMany(),
        prisma.contactSubmission.deleteMany(),
        prisma.siteSetting.deleteMany(),
        prisma.user.deleteMany({
            where: { email: { not: ADMIN_EMAIL } },
        }),
    ]);

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
        await prisma.$disconnect();
    });
