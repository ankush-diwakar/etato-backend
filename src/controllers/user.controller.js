import crypto from "crypto";
import { execute, query } from "../config/db.js";
import { isInDeliveryZone } from "../services/geo.service.js";

export async function updatePhone(req, res) {
  const { phone } = req.validated;

  await execute(
    "UPDATE users SET phone = ?, updatedAt = NOW(3) WHERE id = ?",
    [phone, req.user.id]
  );

  const rows = await query(
    "SELECT id, email, name, phone, role, status, avatarUrl, createdAt FROM users WHERE id = ? LIMIT 1",
    [req.user.id]
  );
  const user = rows[0];

  res.json({ user });
}

export async function updateProfile(req, res) {
  const { name } = req.validated;

  await execute(
    "UPDATE users SET name = ?, updatedAt = NOW(3) WHERE id = ?",
    [name, req.user.id]
  );

  const rows = await query(
    "SELECT id, email, name, phone, role, status, avatarUrl, createdAt FROM users WHERE id = ? LIMIT 1",
    [req.user.id]
  );
  const user = rows[0];

  res.json({ user });
}

export async function addAddress(req, res) {
  const { label, fullAddress, pinCode, latitude, longitude } = req.validated;

  let isInZone = false;
  let distanceKm = null;

  if (latitude && longitude) {
    const check = isInDeliveryZone(latitude, longitude);
    isInZone = check.inZone;
    distanceKm = check.distanceKm;
  }

  // If this is the first address, make it default
  const countRows = await query("SELECT COUNT(*) AS count FROM addresses WHERE userId = ?", [req.user.id]);
  const count = countRows[0]?.count ?? 0;

  const addressId = crypto.randomUUID();
  await execute(
    "INSERT INTO addresses (id, userId, label, fullAddress, pinCode, latitude, longitude, isInZone, isDefault, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))",
    [addressId, req.user.id, label || "Home", fullAddress, pinCode, latitude ?? null, longitude ?? null, isInZone ? 1 : 0, count === 0 ? 1 : 0]
  );

  const addressRows = await query("SELECT * FROM addresses WHERE id = ? LIMIT 1", [addressId]);
  const address = addressRows[0];

  res.status(201).json({ address, isInZone, distanceKm });
}

export async function getAddresses(req, res) {
  const addresses = await query(
    "SELECT * FROM addresses WHERE userId = ? ORDER BY createdAt DESC",
    [req.user.id]
  );

  res.json({ addresses });
}

export async function deleteAddress(req, res) {
  const { id } = req.params;

  const addressRows = await query(
    "SELECT * FROM addresses WHERE id = ? AND userId = ? LIMIT 1",
    [id, req.user.id]
  );
  const address = addressRows[0];

  if (!address) {
    return res.status(404).json({ error: "Address not found." });
  }

  await execute("DELETE FROM addresses WHERE id = ?", [id]);

  res.json({ message: "Address deleted." });
}

export async function checkDeliveryZone(req, res) {
  const { latitude, longitude } = req.validated;
  const result = isInDeliveryZone(latitude, longitude);
  res.json(result);
}

export async function recheckAddressZone(req, res) {
  const { id } = req.params;

  const addressRows = await query(
    "SELECT * FROM addresses WHERE id = ? AND userId = ? LIMIT 1",
    [id, req.user.id]
  );
  const address = addressRows[0];

  if (!address) {
    return res.status(404).json({ error: "Address not found." });
  }

  if (address.latitude == null || address.longitude == null) {
    return res.status(400).json({ error: "Address has no coordinates saved. Please delete and re-add it with location detection." });
  }

  const { inZone, distanceKm } = isInDeliveryZone(address.latitude, address.longitude);

  await execute(
    "UPDATE addresses SET isInZone = ?, updatedAt = NOW(3) WHERE id = ?",
    [inZone ? 1 : 0, id]
  );

  const updatedRows = await query("SELECT * FROM addresses WHERE id = ? LIMIT 1", [id]);
  const updated = updatedRows[0];

  res.json({ address: updated, isInZone: inZone, distanceKm });
}
