import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import blogRoutes from "./routes/blog.routes.js";
import orderRoutes from "./routes/order.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";

const app = express();

// ─── Global Middleware ───────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "https:", "data:", "blob:"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        fontSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https:"],
        frameSrc: ["'self'", "https:"],
        connectSrc: ["'self'", "https:"],
      },
    },
  })
);
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(apiLimiter);

// Static file serving for uploads
app.use("/uploads", express.static("uploads"));

// ─── Routes ──────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", name: "Etato Foods API", version: "1.0.0" });
});


app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// Serve frontend build if present
const frontendDist = path.join(process.cwd(), "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("Email server is working");
  });
}

// ─── Error Handler ───────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────
app.listen(env.PORT, () => {
  console.log(`\n🌿 Etato Foods API running on http://localhost:${env.PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Client URL:  ${env.CLIENT_URL}\n`);
});

export default app;
