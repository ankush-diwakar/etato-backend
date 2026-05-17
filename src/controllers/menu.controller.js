import prisma from "../config/db.js";

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
  const items = await prisma.menuItem.findMany({
    where: { status: { in: ["ACTIVE", "COMING_SOON", "NOT_AVAILABLE"] } },
    include: { category: { select: { id: true, name: true, slug: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const normalized = items.map((item) => ({
    ...item,
    ingredients: normalizeIngredients(item.ingredients),
  }));

  res.json({ items: normalized });
}

export async function getPublicMenuItem(req, res) {
  const { slug } = req.params;

  const item = await prisma.menuItem.findUnique({
    where: { slug },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  if (!item || item.status === "INACTIVE") {
    return res.status(404).json({ error: "Menu item not found." });
  }

  res.json({
    item: {
      ...item,
      ingredients: normalizeIngredients(item.ingredients),
    },
  });
}

export async function getPublicCategories(req, res) {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, sortOrder: true },
  });

  res.json({ categories });
}
