import { Router } from "express";
import { query } from "../config/db.js";

const router = Router();

// List published posts
router.get("/", async (req, res) => {
  const posts = await query(
    `SELECT id, title, slug, excerpt, category, coverUrl, readTime, publishedAt
     FROM blog_posts
     WHERE status = 'PUBLISHED'
     ORDER BY publishedAt DESC`
  );
  res.json({ posts });
});

// Single published post by slug
router.get("/:slug", async (req, res) => {
  const rows = await query("SELECT * FROM blog_posts WHERE slug = ? LIMIT 1", [req.params.slug]);
  const post = rows[0];

  if (!post || post.status !== "PUBLISHED") {
    return res.status(404).json({ error: "Post not found" });
  }

  // Find next post
  const nextRows = await query(
    `SELECT title, slug, coverUrl, category
     FROM blog_posts
     WHERE status = 'PUBLISHED' AND publishedAt < ?
     ORDER BY publishedAt DESC
     LIMIT 1`,
    [post.publishedAt || new Date()]
  );
  const nextPost = nextRows[0];

  // If no older post, wrap around to the newest
  const fallbackRows = !nextPost ? await query(
    `SELECT title, slug, coverUrl, category
     FROM blog_posts
     WHERE status = 'PUBLISHED' AND id <> ?
     ORDER BY publishedAt DESC
     LIMIT 1`,
    [post.id]
  ) : [];
  const fallbackNext = fallbackRows[0] || null;

  res.json({ post, nextPost: nextPost || fallbackNext });
});

export default router;
