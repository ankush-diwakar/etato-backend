import { verifyAccessToken } from "../services/token.service.js";
import { query } from "../config/db.js";

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = header.split(" ")[1];
    const payload = verifyAccessToken(token);

    const rows = await query(
      "SELECT id, email, name, phone, role, status, avatarUrl, createdAt FROM users WHERE id = ? LIMIT 1",
      [payload.sub]
    );
    const user = rows[0];

    if (!user || user.status === "BLOCKED") {
      return res.status(401).json({ error: "Account not found or blocked" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function adminAuth(req, res, next) {
  if (req.user && req.user.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Super Admin access required" });
  }
}
