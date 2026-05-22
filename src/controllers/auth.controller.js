import bcrypt from "bcryptjs";
import crypto from "crypto";
import { execute, query } from "../config/db.js";
import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from "../services/token.service.js";
import { sendWelcomeEmail } from "../services/mail.service.js";

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function signup(req, res) {
  const { name, email, password } = req.validated;

  const existingRows = await query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (existingRows.length > 0) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const userId = crypto.randomUUID();

  await execute(
    "INSERT INTO users (id, email, passwordHash, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(3), NOW(3))",
    [userId, email, passwordHash, name]
  );

  const rows = await query("SELECT * FROM users WHERE id = ? LIMIT 1", [userId]);
  const user = rows[0];

  const accessToken = generateAccessToken(user);
  const refresh = await generateRefreshToken(user);

  res.cookie("etato_refresh", refresh.token, REFRESH_COOKIE_OPTIONS);

  // Send welcome email (non-blocking)
  sendWelcomeEmail(user).catch(() => { });

  res.status(201).json({
    user: sanitizeUser(user),
    accessToken,
  });
}

export async function login(req, res) {
  const { email, password } = req.validated;

  const rows = await query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (user.status === "BLOCKED") {
    return res.status(403).json({ error: "Your account has been blocked. Contact support." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const accessToken = generateAccessToken(user);
  const refresh = await generateRefreshToken(user);

  res.cookie("etato_refresh", refresh.token, REFRESH_COOKIE_OPTIONS);

  res.json({
    user: sanitizeUser(user),
    accessToken,
  });
}

export async function refresh(req, res) {
  const token = req.cookies?.etato_refresh;
  if (!token) {
    return res.status(401).json({ error: "No refresh token provided." });
  }

  const result = await rotateRefreshToken(token);
  if (!result) {
    res.clearCookie("etato_refresh");
    return res.status(401).json({ error: "Invalid or expired refresh token." });
  }

  res.cookie("etato_refresh", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.json({
    user: sanitizeUser(result.user),
    accessToken: result.accessToken,
  });
}

export async function logout(req, res) {
  const token = req.cookies?.etato_refresh;
  if (token) {
    await revokeRefreshToken(token);
    res.clearCookie("etato_refresh");
  }
  res.json({ message: "Logged out successfully." });
}

export async function me(req, res) {
  res.json({ user: req.user });
}
