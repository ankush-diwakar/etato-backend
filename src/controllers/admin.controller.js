import { execute, query, withTransaction } from "../config/db.js";
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
  const [customerRows, menuRows, contactRows] = await Promise.all([
    query("SELECT COUNT(*) AS count FROM users WHERE role = 'CUSTOMER'"),
    query("SELECT COUNT(*) AS count FROM menu_items WHERE status = 'ACTIVE'"),
    query("SELECT COUNT(*) AS count FROM contact_submissions WHERE isRead = 0"),
  ]);

  const customers = customerRows[0]?.count ?? 0;
  const menuItems = menuRows[0]?.count ?? 0;
  const pendingContacts = contactRows[0]?.count ?? 0;

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
  const items = await query(
    `SELECT mi.*, c.id AS category_id, c.name AS category_name
     FROM menu_items mi
     JOIN categories c ON mi.categoryId = c.id
     ORDER BY c.sortOrder ASC, mi.sortOrder ASC`
  );
  const normalized = items.map((item) => ({
    ...item,
    ingredients: normalizeIngredients(typeof item.ingredients === "string" ? JSON.parse(item.ingredients) : item.ingredients),
    category: {
      id: item.category_id,
      name: item.category_name,
    },
  }));
  res.json({ items: normalized });
}

export async function getMenuItem(req, res) {
  const rows = await query("SELECT * FROM menu_items WHERE id = ? LIMIT 1", [req.params.id]);
  const item = rows[0];
  if (!item) return res.status(404).json({ error: "Item not found" });
  res.json({
    item: {
      ...item,
      ingredients: normalizeIngredients(typeof item.ingredients === "string" ? JSON.parse(item.ingredients) : item.ingredients),
    },
  });
}

export async function createMenuItem(req, res) {
  const { name, dressing, categoryId, protein, calories, carbs, fat, fiber, ingredients, price, jain, status, isFeatured, sortOrder } = req.validated;
  const normalizedIngredients = normalizeIngredients(ingredients);

  // Generate slug
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO menu_items
      (id, name, slug, dressing, categoryId, protein, calories, carbs, fat, fiber, ingredients, price, jain, status, isFeatured, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [
      id,
      name,
      slug,
      dressing,
      categoryId,
      protein || null,
      calories || null,
      carbs || null,
      fat || null,
      fiber || null,
      JSON.stringify(normalizedIngredients),
      price ?? null,
      jain ? 1 : 0,
      status,
      isFeatured ? 1 : 0,
      sortOrder ?? 0,
    ]
  );
  const rows = await query("SELECT * FROM menu_items WHERE id = ? LIMIT 1", [id]);
  const item = rows[0];
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

  const fields = [];
  const values = [];

  const setField = (key, value) => {
    fields.push(`${key} = ?`);
    values.push(value);
  };

  if (data.name !== undefined) setField("name", data.name);
  if (data.slug !== undefined) setField("slug", data.slug);
  if (data.dressing !== undefined) setField("dressing", data.dressing);
  if (data.categoryId !== undefined) setField("categoryId", data.categoryId);
  if (data.protein !== undefined) setField("protein", data.protein || null);
  if (data.calories !== undefined) setField("calories", data.calories || null);
  if (data.carbs !== undefined) setField("carbs", data.carbs || null);
  if (data.fat !== undefined) setField("fat", data.fat || null);
  if (data.fiber !== undefined) setField("fiber", data.fiber || null);
  if (data.ingredients !== undefined) setField("ingredients", JSON.stringify(data.ingredients));
  if (data.price !== undefined) setField("price", data.price ?? null);
  if (data.jain !== undefined) setField("jain", data.jain ? 1 : 0);
  if (data.status !== undefined) setField("status", data.status);
  if (data.isFeatured !== undefined) setField("isFeatured", data.isFeatured ? 1 : 0);
  if (data.sortOrder !== undefined) setField("sortOrder", data.sortOrder ?? 0);

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  fields.push("updatedAt = NOW(3)");
  values.push(id);

  await execute(`UPDATE menu_items SET ${fields.join(", ")} WHERE id = ?`, values);
  const rows = await query("SELECT * FROM menu_items WHERE id = ? LIMIT 1", [id]);
  const item = rows[0];
  res.json({ item });
}

export async function updateMenuItemStatus(req, res) {
  const { id } = req.params;
  const { status } = req.validated;
  await execute("UPDATE menu_items SET status = ?, updatedAt = NOW(3) WHERE id = ?", [status, id]);
  const rows = await query("SELECT * FROM menu_items WHERE id = ? LIMIT 1", [id]);
  const item = rows[0];
  res.json({ item });
}

export async function deleteMenuItem(req, res) {
  const { id } = req.params;
  // Soft delete
  await execute("UPDATE menu_items SET status = 'INACTIVE', updatedAt = NOW(3) WHERE id = ?", [id]);
  res.json({ message: "Menu item deactivated" });
}

export async function deleteMenuItemPermanently(req, res) {
  const { id } = req.params;

  const itemRows = await query("SELECT * FROM menu_items WHERE id = ? LIMIT 1", [id]);
  const item = itemRows[0];
  if (!item) return res.status(404).json({ error: "Item not found" });

  const orderItemRows = await query(
    "SELECT COUNT(*) AS count FROM order_items WHERE menuItemId = ?",
    [id]
  );
  if ((orderItemRows[0]?.count ?? 0) > 0) {
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

  await execute("DELETE FROM menu_items WHERE id = ?", [id]);
  res.json({ message: "Menu item deleted" });
}

export async function uploadMenuItemImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const { id } = req.params;
  const imageUrl = `${env.CLIENT_URL.replace('8080', '4000')}/uploads/menu/${req.file.filename}`; // serve from backend

  await execute(
    "UPDATE menu_items SET imageUrl = ?, updatedAt = NOW(3) WHERE id = ?",
    [imageUrl, id]
  );
  const itemRows = await query("SELECT * FROM menu_items WHERE id = ? LIMIT 1", [id]);
  const item = itemRows[0];

  res.json({ imageUrl, item });
}

// ─── CATEGORIES ─────────────────────────────────────────

export async function getCategories(req, res) {
  const categories = await query("SELECT * FROM categories ORDER BY sortOrder ASC");
  res.json({ categories });
}

export async function createCategory(req, res) {
  const { name, sortOrder, isActive } = req.validated;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  const id = crypto.randomUUID();
  await execute(
    "INSERT INTO categories (id, name, slug, sortOrder, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(3), NOW(3))",
    [id, name, slug, sortOrder ?? 0, isActive ? 1 : 0]
  );
  const rows = await query("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
  const category = rows[0];
  res.status(201).json({ category });
}

export async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, sortOrder, isActive } = req.validated;

  const fields = [];
  const values = [];

  if (name !== undefined) {
    fields.push("name = ?", "slug = ?");
    values.push(name, name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  }
  if (sortOrder !== undefined) {
    fields.push("sortOrder = ?");
    values.push(sortOrder);
  }
  if (isActive !== undefined) {
    fields.push("isActive = ?");
    values.push(isActive ? 1 : 0);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  fields.push("updatedAt = NOW(3)");
  values.push(id);

  await execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, values);
  const rows = await query("SELECT * FROM categories WHERE id = ? LIMIT 1", [id]);
  const category = rows[0];
  res.json({ category });
}

export async function deleteCategory(req, res) {
  const { id } = req.params;
  const itemRows = await query(
    "SELECT COUNT(*) AS count FROM menu_items WHERE categoryId = ?",
    [id]
  );
  if ((itemRows[0]?.count ?? 0) > 0) {
    return res.status(400).json({ error: "Cannot delete category with linked menu items" });
  }

  await execute("DELETE FROM categories WHERE id = ?", [id]);
  res.json({ message: "Category deleted" });
}

// ─── CUSTOMERS ──────────────────────────────────────────

export async function getCustomers(req, res) {
  const customers = await query(
    "SELECT id, name, email, phone, status, createdAt FROM users WHERE role = 'CUSTOMER' ORDER BY createdAt DESC"
  );

  if (customers.length === 0) {
    return res.json({ customers: [] });
  }

  const userIds = customers.map((c) => c.id);
  const placeholders = userIds.map(() => "?").join(", ");

  const subscriptions = await query(
    `SELECT s.*, p.id AS plan_id, p.name AS plan_name, p.type AS plan_type, p.durationDays, p.bowlsCount, p.originalPrice, p.price, p.discountPct, p.perBowlPrice, p.isActive, p.sortOrder
     FROM subscriptions s
     JOIN subscription_plans p ON s.planId = p.id
     WHERE s.status IN ("ACTIVE", "PAUSED", "PENDING")
       AND s.userId IN (${placeholders})`,
    userIds
  );

  const subsByUser = new Map();
  for (const sub of subscriptions) {
    const entry = {
      ...sub,
      plan: {
        id: sub.plan_id,
        name: sub.plan_name,
        type: sub.plan_type,
        durationDays: sub.durationDays,
        bowlsCount: sub.bowlsCount,
        originalPrice: sub.originalPrice,
        price: sub.price,
        discountPct: sub.discountPct,
        perBowlPrice: sub.perBowlPrice,
        isActive: sub.isActive,
        sortOrder: sub.sortOrder,
      },
    };
    if (!subsByUser.has(sub.userId)) subsByUser.set(sub.userId, []);
    subsByUser.get(sub.userId).push(entry);
  }

  const enriched = customers.map((c) => ({
    ...c,
    subscriptions: subsByUser.get(c.id) || [],
  }));

  res.json({ customers: enriched });
}

export async function updateCustomerStatus(req, res) {
  const { id } = req.params;
  const { status } = req.validated;
  await execute("UPDATE users SET status = ?, updatedAt = NOW(3) WHERE id = ?", [status, id]);
  const rows = await query("SELECT id, name, status FROM users WHERE id = ? LIMIT 1", [id]);
  const customer = rows[0];
  res.json({ customer });
}

export async function adminAddCustomerSubscription(req, res, next) {
  try {
    const { id } = req.params;
    const { planId, deliverySlot, dietaryPref, bowlPreference, startDate } = req.validated;

    const userRows = await query("SELECT id FROM users WHERE id = ? LIMIT 1", [id]);
    if (!userRows[0]) return res.status(404).json({ error: "User not found" });

    const existing = await query(
      "SELECT id FROM subscriptions WHERE userId = ? AND status IN ('ACTIVE', 'PAUSED') LIMIT 1",
      [id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "User already has an active or paused subscription" });
    }

    const planRows = await query("SELECT * FROM subscription_plans WHERE id = ? LIMIT 1", [planId]);
    const plan = planRows[0];
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: "Active subscription plan not found" });
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid start date" });
    }

    const end = new Date(start);
    end.setDate(end.getDate() + plan.durationDays);

    const result = await withTransaction(async (conn) => {
      const subscriptionId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO subscriptions
          (id, userId, planId, status, deliverySlot, dietaryPref, bowlPreference, startDate, endDate, pausedDays, specialNotes, createdAt, updatedAt)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 0, NULL, NOW(3), NOW(3))`,
        [subscriptionId, id, planId, deliverySlot, dietaryPref || "REGULAR_VEG", bowlPreference || null, start, end]
      );

      const paymentId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO payments
          (id, subscriptionId, amount, status, method, razorpayPaymentId, paidAt, createdAt, updatedAt)
         VALUES (?, ?, ?, 'CAPTURED', ?, ?, ?, NOW(3), NOW(3))`,
        [paymentId, subscriptionId, plan.price * 100, "MANUAL_ADMIN", `MANUAL_${crypto.randomBytes(4).toString("hex").toUpperCase()}`, new Date()]
      );

      const [subRows] = await conn.query(
        `SELECT s.*, p.id AS plan_id, p.name AS plan_name, p.type AS plan_type, p.durationDays, p.bowlsCount, p.originalPrice, p.price, p.discountPct, p.perBowlPrice, p.isActive, p.sortOrder
         FROM subscriptions s
         JOIN subscription_plans p ON s.planId = p.id
         WHERE s.id = ?`,
        [subscriptionId]
      );

      const subscription = subRows[0];
      return { subscription, paymentId };
    });

    const paymentRows = await query("SELECT * FROM payments WHERE id = ? LIMIT 1", [result.paymentId]);
    const payment = paymentRows[0];

    const subscription = {
      ...result.subscription,
      plan: {
        id: result.subscription.plan_id,
        name: result.subscription.plan_name,
        type: result.subscription.plan_type,
        durationDays: result.subscription.durationDays,
        bowlsCount: result.subscription.bowlsCount,
        originalPrice: result.subscription.originalPrice,
        price: result.subscription.price,
        discountPct: result.subscription.discountPct,
        perBowlPrice: result.subscription.perBowlPrice,
        isActive: result.subscription.isActive,
        sortOrder: result.subscription.sortOrder,
      },
    };

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

    await execute("UPDATE subscriptions SET status = ?, updatedAt = NOW(3) WHERE id = ?", [status, subId]);
    const rows = await query(
      `SELECT s.*, p.id AS plan_id, p.name AS plan_name, p.type AS plan_type, p.durationDays, p.bowlsCount, p.originalPrice, p.price, p.discountPct, p.perBowlPrice, p.isActive, p.sortOrder
       FROM subscriptions s
       JOIN subscription_plans p ON s.planId = p.id
       WHERE s.id = ?`,
      [subId]
    );
    const updated = rows[0];
    const subscription = {
      ...updated,
      plan: {
        id: updated.plan_id,
        name: updated.plan_name,
        type: updated.plan_type,
        durationDays: updated.durationDays,
        bowlsCount: updated.bowlsCount,
        originalPrice: updated.originalPrice,
        price: updated.price,
        discountPct: updated.discountPct,
        perBowlPrice: updated.perBowlPrice,
        isActive: updated.isActive,
        sortOrder: updated.sortOrder,
      },
    };

    res.json({
      message: `Subscription status updated to ${status}`,
      subscription,
    });
  } catch (error) {
    next(error);
  }
}

// ─── CONTACTS ───────────────────────────────────────────

export async function getContacts(req, res) {
  const contacts = await query("SELECT * FROM contact_submissions ORDER BY createdAt DESC");
  res.json({ contacts });
}

export async function replyContact(req, res) {
  const { id } = req.params;
  const { replyText, markRead } = req.validated;

  const contactRows = await query("SELECT * FROM contact_submissions WHERE id = ? LIMIT 1", [id]);
  const contact = contactRows[0];
  if (!contact) return res.status(404).json({ error: "Contact not found" });

  const fields = [];
  const values = [];

  if (markRead) {
    fields.push("isRead = 1");
  }
  if (replyText) {
    fields.push("adminNote = ?", "repliedAt = ?", "isRead = 1");
    values.push(replyText, new Date());
  }

  if (fields.length > 0) {
    values.push(id);
    await execute(`UPDATE contact_submissions SET ${fields.join(", ")} WHERE id = ?`, values);
  }

  const updatedRows = await query("SELECT * FROM contact_submissions WHERE id = ? LIMIT 1", [id]);
  const updated = updatedRows[0];

  res.json({ contact: updated });
}

// ─── BLOG ───────────────────────────────────────────────

export async function getBlogPosts(req, res) {
  const posts = await query("SELECT * FROM blog_posts ORDER BY createdAt DESC");
  res.json({ posts });
}

export async function getBlogPost(req, res) {
  const rows = await query("SELECT * FROM blog_posts WHERE id = ? LIMIT 1", [req.params.id]);
  const post = rows[0];
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json({ post });
}

export async function createBlogPost(req, res) {
  const { title, excerpt, body, category, status } = req.validated;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

  // simple read time calc
  const words = body.split(/\s+/).length;
  const readTime = `${Math.ceil(words / 200)} min read`;

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO blog_posts
      (id, title, slug, excerpt, body, coverUrl, category, readTime, status, publishedAt, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NOW(3), NOW(3))`,
    [
      id,
      title,
      slug,
      excerpt || "",
      body,
      category || "",
      readTime,
      status,
      status === "PUBLISHED" ? new Date() : null,
    ]
  );
  const rows = await query("SELECT * FROM blog_posts WHERE id = ? LIMIT 1", [id]);
  const post = rows[0];
  res.status(201).json({ post });
}

export async function updateBlogPost(req, res) {
  const { id } = req.params;
  const { title, excerpt, body, category, status } = req.validated;

  const fields = [];
  const values = [];

  if (excerpt !== undefined) {
    fields.push("excerpt = ?");
    values.push(excerpt || "");
  }
  if (body !== undefined) {
    fields.push("body = ?");
    values.push(body);
    const words = body.split(/\s+/).length;
    fields.push("readTime = ?");
    values.push(`${Math.ceil(words / 200)} min read`);
  }
  if (category !== undefined) {
    fields.push("category = ?");
    values.push(category || "");
  }
  if (status !== undefined) {
    fields.push("status = ?");
    values.push(status);
    if (status === "PUBLISHED") {
      fields.push("publishedAt = ?");
      values.push(new Date());
    }
  }
  if (title !== undefined) {
    fields.push("title = ?", "slug = ?");
    values.push(title, title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, ""));
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  fields.push("updatedAt = NOW(3)");
  values.push(id);

  await execute(`UPDATE blog_posts SET ${fields.join(", ")} WHERE id = ?`, values);
  const rows = await query("SELECT * FROM blog_posts WHERE id = ? LIMIT 1", [id]);
  const post = rows[0];
  res.json({ post });
}

export async function uploadBlogCover(req, res) {
  if (!req.file) return res.status(400).json({ error: "No image file provided" });

  const { id } = req.params;
  const coverUrl = `${env.CLIENT_URL.replace('8080', '4000')}/uploads/blog/${req.file.filename}`;

  await execute(
    "UPDATE blog_posts SET coverUrl = ?, updatedAt = NOW(3) WHERE id = ?",
    [coverUrl, id]
  );
  const rows = await query("SELECT * FROM blog_posts WHERE id = ? LIMIT 1", [id]);
  const post = rows[0];

  res.json({ coverUrl, post });
}

export async function deleteBlogPost(req, res) {
  const { id } = req.params;
  await execute("DELETE FROM blog_posts WHERE id = ?", [id]);
  res.json({ message: "Post deleted" });
}

export async function getPayments(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countRows = await query("SELECT COUNT(*) AS total FROM payments");
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const sumRows = await query("SELECT SUM(amount) AS totalCaptured FROM payments WHERE status IN ('CAPTURED', 'PAID', 'SUCCESS')");
    const totalCaptured = sumRows[0]?.totalCaptured || 0;

    const rows = await query(
      `SELECT p.*, 
              o.orderNumber AS orderNumber,
              ou.name AS orderUserName,
              ou.email AS orderUserEmail,
              s.id AS subscriptionId,
              sp.name AS subscriptionPlanName,
              su.name AS subscriptionUserName,
              su.email AS subscriptionUserEmail
       FROM payments p
       LEFT JOIN orders o ON p.orderId = o.id
       LEFT JOIN users ou ON o.userId = ou.id
       LEFT JOIN subscriptions s ON p.subscriptionId = s.id
       LEFT JOIN subscription_plans sp ON s.planId = sp.id
       LEFT JOIN users su ON s.userId = su.id
       ORDER BY p.createdAt DESC
       LIMIT ? OFFSET ?`,
       [limit, offset]
    );

    const payments = rows.map((row) => ({
      ...row,
      order: row.orderNumber ? {
        orderNumber: row.orderNumber,
        user: row.orderUserName ? { name: row.orderUserName, email: row.orderUserEmail } : null,
      } : null,
      subscription: row.subscriptionId ? {
        id: row.subscriptionId,
        plan: row.subscriptionPlanName ? { name: row.subscriptionPlanName } : null,
        user: row.subscriptionUserName ? { name: row.subscriptionUserName, email: row.subscriptionUserEmail } : null,
      } : null,
    }));

    res.json({ payments, total, page, totalPages, totalCaptured });
  } catch (error) {
    next(error);
  }
}

// ─── ORDERS ───────────────────────────────────────────────

export async function getOrders(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countRows = await query("SELECT COUNT(*) AS total FROM orders");
    const total = countRows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const rows = await query(
      `SELECT o.*, u.name AS userName, u.email AS userEmail, u.phone AS userPhone 
       FROM orders o 
       LEFT JOIN users u ON o.userId = u.id 
       ORDER BY o.createdAt DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    if (rows.length === 0) {
      return res.json({ orders: [], total: 0, page, totalPages });
    }

    const orderIds = rows.map((o) => o.id);
    const placeholders = orderIds.map(() => "?").join(", ");

    const items = await query(
      `SELECT oi.*, mi.name AS menuItemName 
       FROM order_items oi 
       JOIN menu_items mi ON oi.menuItemId = mi.id 
       WHERE oi.orderId IN (${placeholders})`,
      orderIds
    );

    const itemsByOrder = new Map();
    for (const item of items) {
      if (!itemsByOrder.has(item.orderId)) itemsByOrder.set(item.orderId, []);
      itemsByOrder.get(item.orderId).push(item);
    }

    const orders = rows.map((row) => ({
      ...row,
      user: { name: row.userName, email: row.userEmail, phone: row.userPhone },
      items: itemsByOrder.get(row.id) || [],
    }));

    res.json({ orders, total, page, totalPages });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.validated;

    await execute("UPDATE orders SET status = ?, updatedAt = NOW(3) WHERE id = ?", [status, id]);
    
    res.json({ message: "Order status updated successfully", status });
  } catch (error) {
    next(error);
  }
}

// ─── SUBSCRIPTIONS ──────────────────────────────────────

export async function getSubscriptions(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countRows = await query("SELECT COUNT(*) AS total FROM subscriptions");
    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limit);

    const subscriptions = await query(
      `SELECT s.*, 
              u.name AS userName, u.email AS userEmail, u.phone AS userPhone,
              p.id AS plan_id, p.name AS plan_name, p.durationDays, p.bowlsCount, p.price, p.originalPrice
       FROM subscriptions s
       LEFT JOIN users u ON s.userId = u.id
       LEFT JOIN subscription_plans p ON s.planId = p.id
       ORDER BY s.createdAt DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const enriched = subscriptions.map(sub => ({
      ...sub,
      user: { name: sub.userName, email: sub.userEmail, phone: sub.userPhone },
      plan: {
        id: sub.plan_id,
        name: sub.plan_name,
        durationDays: sub.durationDays,
        bowlsCount: sub.bowlsCount,
        price: sub.price,
        originalPrice: sub.originalPrice,
      }
    }));

    res.json({ subscriptions: enriched, total, page, totalPages });
  } catch (error) {
    next(error);
  }
}
