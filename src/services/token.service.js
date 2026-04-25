import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
import prisma from "../config/db.js";

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

  await prisma.refreshToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  return { token, expiresAt };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export async function rotateRefreshToken(oldToken) {
  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.refreshToken.delete({ where: { id: stored.id } });
    return null;
  }

  // Delete old token
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  // Create new one
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) return null;

  const newRefresh = await generateRefreshToken(user);
  const accessToken = generateAccessToken(user);

  return { accessToken, refreshToken: newRefresh.token, expiresAt: newRefresh.expiresAt, user };
}

export async function revokeRefreshToken(token) {
  try {
    await prisma.refreshToken.delete({ where: { token } });
  } catch {
    // Token might not exist — that's fine
  }
}

export async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}
