import prisma from "../config/db.js";
import { env } from "../config/env.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

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

// ─── DASHBOARD STATS ────────────────────────────────────

export async function getDashboardStats(req, res) {
  const [customers, menuItems, pendingContacts] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.menuItem.count({ where: { status: "ACTIVE" } }),
    prisma.contactSubmission.count({ where: { isRead: false } }),
  ]);

  res.json({
    stats: {
      customers,
      menuItems,
      pendingContacts,
    },
  });
}

// ─── MENU ITEMS ─────────────────────────────────────────

export async function getMenuItems(req, res) {
  const items = await prisma.menuItem.findMany({
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const normalized = items.map((item) => ({
    ...item,
    ingredients: normalizeIngredients(item.ingredients),
  }));
  res.json({ items: normalized });
}

export async function getMenuItem(req, res) {
  const item = await prisma.menuItem.findUnique({
    where: { id: req.params.id },
  });
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({
    item: {
      ...item,
      ingredients: normalizeIngredients(item.ingredients),
    },
  });
}

export async function createMenuItem(req, res) {
  const { name, dressing, categoryId, protein, calories, carbs, fat, fiber, ingredients, price, jain, status, isFeatured, sortOrder } = req.validated;
  const normalizedIngredients = normalizeIngredients(ingredients);

  // Generate slug
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  const item = await prisma.menuItem.create({
    data: {
      name, slug, dressing, categoryId, protein, calories, carbs, fat, fiber,
      ingredients: normalizedIngredients, price, jain, status, isFeatured, sortOrder
    },
  });
  res.status(201).json({ item });
}

export async function updateMenuItem(req, res) {
  const { id } = req.params;
  const data = req.validated;

  if (data.name) {
    data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  }
  if (Object.prototype.hasOwnProperty.call(data, "ingredients")) {
    data.ingredients = normalizeIngredients(data.ingredients);
  }

  const item = await prisma.menuItem.update({
    where: { id },
    data,
  });
  res.json({ item });
}

export async function updateMenuItemStatus(req, res) {
  const { id } = req.params;
  const { status } = req.validated;
  const item = await prisma.menuItem.update({
    where: { id },
    data: { status },
  });
  res.json({ item });
}

export async function deleteMenuItem(req, res) {
  const { id } = req.params;
  // Soft delete
  await prisma.menuItem.update({
    where: { id },
    data: { status: "INACTIVE" },
  });
  res.json({ message: "Menu item deactivated" });
}

export async function deleteMenuItemPermanently(req, res) {
  const { id } = req.params;

  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "Item not found" });

  const orderItemsCount = await prisma.orderItem.count({ where: { menuItemId: id } });
  if (orderItemsCount > 0) {
    return res.status(400).json({ error: "Cannot delete item with existing orders" });
  }

  if (item.imageUrl && item.imageUrl.includes("/uploads/menu/")) {
    const fileName = item.imageUrl.split("/uploads/menu/")[1];
    if (fileName) {
      const filePath = path.join(process.cwd(), "uploads", "menu", fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  await prisma.menuItem.delete({ where: { id } });
  res.json({ message: "Menu item deleted" });
}

export async function uploadMenuItemImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const { id } = req.params;
  const imageUrl = `${env.CLIENT_URL.replace('8080', '4000')}/uploads/menu/${req.file.filename}`; // serve from backend

  const item = await prisma.menuItem.update({
    where: { id },
    data: { imageUrl },
  });

  res.json({ imageUrl, item });
}

// ─── CATEGORIES ─────────────────────────────────────────

export async function getCategories(req, res) {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  res.json({ categories });
}

export async function createCategory(req, res) {
  const { name, sortOrder, isActive } = req.validated;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  const category = await prisma.category.create({
    data: { name, slug, sortOrder, isActive },
  });
  res.status(201).json({ category });
}

export async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, sortOrder, isActive } = req.validated;

  let data = { sortOrder, isActive };
  if (name) {
    data.name = name;
    data.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  }

  const category = await prisma.category.update({
    where: { id },
    data,
  });
  res.json({ category });
}

export async function deleteCategory(req, res) {
  const { id } = req.params;

  const itemsCount = await prisma.menuItem.count({ where: { categoryId: id } });
  if (itemsCount > 0) {
    return res.status(400).json({ error: "Cannot delete category with linked menu items" });
  }

  await prisma.category.delete({ where: { id } });
  res.json({ message: "Category deleted" });
}

// ─── CUSTOMERS ──────────────────────────────────────────

export async function getCustomers(req, res) {
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      subscriptions: {
        where: {
          status: { in: ["ACTIVE", "PAUSED", "PENDING"] }
        },
        include: {
          plan: true
        }
      }
    },
  });
  res.json({ customers });
}

export async function updateCustomerStatus(req, res) {
  const { id } = req.params;
  const { status } = req.validated;
  const customer = await prisma.user.update({
    where: { id },
    data: { status },
    select: { id: true, name: true, status: true },
  });
  res.json({ customer });
}

export async function adminAddCustomerSubscription(req, res, next) {
  try {
    const { id } = req.params;
    const { planId, deliverySlot, dietaryPref, bowlPreference, startDate } = req.validated;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check existing active or paused subscriptions
    const existingActiveSub = await prisma.subscription.findFirst({
      where: {
        userId: id,
        status: { in: ["ACTIVE", "PAUSED"] },
      },
    });
    if (existingActiveSub) {
      return res.status(400).json({ error: "User already has an active or paused subscription" });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: "Active subscription plan not found" });
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid start date" });
    }

    const end = new Date(start);
    end.setDate(end.getDate() + plan.durationDays);

    // Create Subscription
    const subscription = await prisma.subscription.create({
      data: {
        userId: id,
        planId,
        deliverySlot,
        dietaryPref: dietaryPref || "REGULAR_VEG",
        bowlPreference,
        startDate: start,
        endDate: end,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      }
    });

    // Create Captured Payment
    const payment = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        amount: plan.price * 100, // paise
        status: "CAPTURED",
        method: "MANUAL_ADMIN",
        razorpayPaymentId: `MANUAL_${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        paidAt: new Date(),
      },
    });

    res.status(201).json({
      message: "Subscription added successfully",
      subscription,
      payment,
    });
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateCustomerSubscriptionStatus(req, res, next) {
  try {
    const { subId } = req.params;
    const { status } = req.validated;

    const updated = await prisma.subscription.update({
      where: { id: subId },
      data: { status },
      include: {
        plan: true,
      }
    });

    res.json({
      message: `Subscription status updated to ${status}`,
      subscription: updated,
    });
  } catch (error) {
    next(error);
  }
}

// ─── CONTACTS ───────────────────────────────────────────

export async function getContacts(req, res) {
  const contacts = await prisma.contactSubmission.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json({ contacts });
}

export async function replyContact(req, res) {
  const { id } = req.params;
  const { replyText, markRead } = req.validated;

  const contact = await prisma.contactSubmission.findUnique({ where: { id } });
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  let data = {};
  if (markRead) data.isRead = true;
  if (replyText) {
    data.adminNote = replyText;
    data.repliedAt = new Date();
    data.isRead = true;
  }

  const updated = await prisma.contactSubmission.update({
    where: { id },
    data,
  });

  res.json({ contact: updated });
}

// ─── BLOG ───────────────────────────────────────────────

export async function getBlogPosts(req, res) {
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json({ posts });
}

export async function getBlogPost(req, res) {
  const post = await prisma.blogPost.findUnique({
    where: { id: req.params.id },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json({ post });
}

export async function createBlogPost(req, res) {
  const { title, excerpt, body, category, status } = req.validated;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  // simple read time calc
  const words = body.split(/\s+/).length;
  const readTime = `${Math.ceil(words / 200)} min read`;

  const post = await prisma.blogPost.create({
    data: {
      title, slug, excerpt, body, category, status, readTime,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });
  res.status(201).json({ post });
}

export async function updateBlogPost(req, res) {
  const { id } = req.params;
  const { title, excerpt, body, category, status } = req.validated;

  let data = { excerpt, body, category, status };
  if (title) {
    data.title = title;
    data.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  }
  if (body) {
    const words = body.split(/\s+/).length;
    data.readTime = `${Math.ceil(words / 200)} min read`;
  }
  if (status === "PUBLISHED") {
    data.publishedAt = new Date();
  }

  const post = await prisma.blogPost.update({
    where: { id },
    data,
  });
  res.json({ post });
}

export async function uploadBlogCover(req, res) {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const { id } = req.params;
  const coverUrl = `${env.CLIENT_URL.replace('8080', '4000')}/uploads/blog/${req.file.filename}`;

  const post = await prisma.blogPost.update({
    where: { id },
    data: { coverUrl },
  });

  res.json({ coverUrl, post });
}

export async function deleteBlogPost(req, res) {
  const { id } = req.params;
  await prisma.blogPost.delete({ where: { id } });
  res.json({ message: "Post deleted" });
}

export async function getPayments(req, res, next) {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            orderNumber: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        subscription: {
          select: {
            id: true,
            plan: {
              select: {
                name: true
              }
            },
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json({ payments });
  } catch (error) {
    next(error);
  }
}
