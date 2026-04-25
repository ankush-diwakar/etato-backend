import { Router } from "express";
import prisma from "../config/db.js";

const router = Router();

// List published posts
router.get("/", async (req, res) => {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      category: true,
      coverUrl: true,
      readTime: true,
      publishedAt: true,
    },
  });
  res.json({ posts });
});

// Single published post by slug
router.get("/:slug", async (req, res) => {
  const post = await prisma.blogPost.findUnique({
    where: { slug: req.params.slug },
  });

  if (!post || post.status !== "PUBLISHED") {
    return res.status(404).json({ error: "Post not found" });
  }

  // Find next post
  const nextPost = await prisma.blogPost.findFirst({
    where: { 
      status: "PUBLISHED", 
      publishedAt: { lt: post.publishedAt || new Date() }
    },
    orderBy: { publishedAt: "desc" },
    select: {
      title: true,
      slug: true,
      coverUrl: true,
      category: true,
    }
  });

  // If no older post, wrap around to the newest
  const fallbackNext = !nextPost ? await prisma.blogPost.findFirst({
    where: { status: "PUBLISHED", id: { not: post.id } },
    orderBy: { publishedAt: "desc" },
    select: { title: true, slug: true, coverUrl: true, category: true }
  }) : null;

  res.json({ post, nextPost: nextPost || fallbackNext });
});

export default router;
