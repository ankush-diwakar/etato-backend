export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
