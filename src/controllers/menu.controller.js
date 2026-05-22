import { query } from "../config/db.js";

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

export async function getPublicMenu(req, res) {
  const items = await query(
    `SELECT mi.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM menu_items mi
     JOIN categories c ON mi.categoryId = c.id
     WHERE mi.status IN ("ACTIVE", "COMING_SOON", "NOT_AVAILABLE")
     ORDER BY c.sortOrder ASC, mi.sortOrder ASC`
  );
  const normalized = items.map((item) => ({
    ...item,
    ingredients: normalizeIngredients(typeof item.ingredients === "string" ? JSON.parse(item.ingredients) : item.ingredients),
    category: {
      id: item.category_id,
      name: item.category_name,
      slug: item.category_slug,
    },
  }));

  res.json({ items: normalized });
}

export async function getPublicMenuItem(req, res) {
  const { slug } = req.params;

  const rows = await query(
    `SELECT mi.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM menu_items mi
     JOIN categories c ON mi.categoryId = c.id
     WHERE mi.slug = ?
     LIMIT 1`,
    [slug]
  );
  const item = rows[0];

  if (!item || item.status === "INACTIVE") {
    return res.status(404).json({ error: "Menu item not found." });
  }

  res.json({
    item: {
      ...item,
      ingredients: normalizeIngredients(typeof item.ingredients === "string" ? JSON.parse(item.ingredients) : item.ingredients),
      category: {
        id: item.category_id,
        name: item.category_name,
        slug: item.category_slug,
      },
    },
  });
}

export async function getPublicCategories(req, res) {
  const categories = await query(
    "SELECT id, name, slug, sortOrder FROM categories WHERE isActive = 1 ORDER BY sortOrder ASC"
  );

  res.json({ categories });
}
