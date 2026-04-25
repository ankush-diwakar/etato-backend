export function errorHandler(err, req, res, _next) {
  console.error("❌ Error:", err.message);

  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  // Prisma known errors
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "field";
    return res.status(409).json({ error: `A record with this ${field} already exists.` });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found." });
  }

  const status = err.statusCode || err.status || 500;
  const message = status === 500 ? "Internal server error" : err.message;

  res.status(status).json({ error: message });
}
