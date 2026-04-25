import "dotenv/config";

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:8080",
  DATABASE_URL: required("DATABASE_URL"),

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",

  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  MAIL_FROM: process.env.MAIL_FROM || "Etato Foods <etatofoods@gmail.com>",

  CLOUD_KITCHEN_LAT: parseFloat(process.env.CLOUD_KITCHEN_LAT || "18.4529"),
  CLOUD_KITCHEN_LNG: parseFloat(process.env.CLOUD_KITCHEN_LNG || "73.8548"),
  MAX_DELIVERY_RADIUS_KM: parseFloat(process.env.MAX_DELIVERY_RADIUS_KM || "10"),

  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL || "etatofoods@gmail.com",
  SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD || "EtatoAdmin@2026",
};
