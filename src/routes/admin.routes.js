import { Router } from "express";
import { authenticate as auth, adminAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import * as adminController from "../controllers/admin.controller.js";
import { upload, setUploadPath } from "../config/upload.js";

const router = Router();

// Protect all admin routes
router.use(auth, adminAuth);

// ─── DASHBOARD ──────────────────────────────────────────
router.get("/stats", adminController.getDashboardStats);

// ─── CATEGORIES ─────────────────────────────────────────
const categorySchema = z.object({
  name: z.string().min(2),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

router.get("/categories", adminController.getCategories);
router.post("/categories", validate(categorySchema), adminController.createCategory);
router.put("/categories/:id", validate(categorySchema.partial()), adminController.updateCategory);
router.delete("/categories/:id", adminController.deleteCategory);

// ─── MENU ITEMS ─────────────────────────────────────────
const menuItemSchema = z.object({
  name: z.string().min(2),
  dressing: z.string().min(2),
  categoryId: z.string().min(1),
  protein: z.string().optional().nullable(),
  calories: z.string().optional().nullable(),
  carbs: z.string().optional().nullable(),
  fat: z.string().optional().nullable(),
  fiber: z.string().optional().nullable(),
  ingredients: z.array(z.string()).default([]),
  price: z.number().int().min(0).optional().nullable(),
  jain: z.boolean().default(false),
  status: z.enum(["ACTIVE", "INACTIVE", "COMING_SOON", "NOT_AVAILABLE"]).default("ACTIVE"),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

router.get("/menu", adminController.getMenuItems);
router.get("/menu/:id", adminController.getMenuItem);
router.post("/menu", validate(menuItemSchema), adminController.createMenuItem);
router.put("/menu/:id", validate(menuItemSchema.partial()), adminController.updateMenuItem);
router.patch("/menu/:id/status", validate(z.object({ status: menuItemSchema.shape.status })), adminController.updateMenuItemStatus);
router.delete("/menu/:id", adminController.deleteMenuItem);
router.post("/menu/:id/image", setUploadPath("menu"), upload.single("image"), adminController.uploadMenuItemImage);

// ─── CUSTOMERS ──────────────────────────────────────────
router.get("/customers", adminController.getCustomers);
router.patch("/customers/:id/status", validate(z.object({ status: z.enum(["ACTIVE", "BLOCKED", "DEACTIVATED"]) })), adminController.updateCustomerStatus);

// ─── CONTACTS ───────────────────────────────────────────
router.get("/contacts", adminController.getContacts);
router.post("/contacts/:id/reply", validate(z.object({
  replyText: z.string().optional(),
  markRead: z.boolean().optional(),
})), adminController.replyContact);

// ─── BLOG ───────────────────────────────────────────────
const blogSchema = z.object({
  title: z.string().min(5),
  excerpt: z.string().optional().nullable(),
  body: z.string().min(10),
  category: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

router.get("/blog", adminController.getBlogPosts);
router.get("/blog/:id", adminController.getBlogPost);
router.post("/blog", validate(blogSchema), adminController.createBlogPost);
router.put("/blog/:id", validate(blogSchema.partial()), adminController.updateBlogPost);
router.delete("/blog/:id", adminController.deleteBlogPost);
router.post("/blog/:id/cover", setUploadPath("blog"), upload.single("image"), adminController.uploadBlogCover);

export default router;
