import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import { execute, query } from "../config/db.js";

export function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRY }
  );
}

export async function generateRefreshToken(user) {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await execute(
    "INSERT INTO refresh_tokens (id, token, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?, NOW(3))",
    [crypto.randomUUID(), token, user.id, expiresAt]
  );

  return { token, expiresAt };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export async function rotateRefreshToken(oldToken) {
  const rows = await query("SELECT * FROM refresh_tokens WHERE token = ? LIMIT 1", [oldToken]);
  const stored = rows[0];
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await execute("DELETE FROM refresh_tokens WHERE id = ?", [stored.id]);
    return null;
  }

  // Delete old token
  await execute("DELETE FROM refresh_tokens WHERE id = ?", [stored.id]);

  // Create new one
  const users = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [stored.userId]);
  const user = users[0];
  if (!user) return null;

  const newRefresh = await generateRefreshToken(user);
  const accessToken = generateAccessToken(user);

  return { accessToken, refreshToken: newRefresh.token, expiresAt: newRefresh.expiresAt, user };
}

export async function revokeRefreshToken(token) {
  try {
    await execute("DELETE FROM refresh_tokens WHERE token = ?", [token]);
  } catch {
    // Token might not exist — that's fine
  }
}

export async function revokeAllUserTokens(userId) {
  await execute("DELETE FROM refresh_tokens WHERE userId = ?", [userId]);
}
