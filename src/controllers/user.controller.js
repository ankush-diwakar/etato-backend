import prisma from "../config/db.js";
import { isInDeliveryZone } from "../services/geo.service.js";

export async function updatePhone(req, res) {
  const { phone } = req.validated;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { phone },
    select: { id: true, email: true, name: true, phone: true, role: true, status: true, avatarUrl: true, createdAt: true },
  });

  res.json({ user });
}

export async function updateProfile(req, res) {
  const { name } = req.validated;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { name },
    select: { id: true, email: true, name: true, phone: true, role: true, status: true, avatarUrl: true, createdAt: true },
  });

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
  const count = await prisma.address.count({ where: { userId: req.user.id } });

  const address = await prisma.address.create({
    data: {
      userId: req.user.id,
      label: label || "Home",
      fullAddress,
      pinCode,
      latitude,
      longitude,
      isInZone,
      isDefault: count === 0,
    },
  });

  res.status(201).json({ address, isInZone, distanceKm });
}

export async function getAddresses(req, res) {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });

  res.json({ addresses });
}

export async function deleteAddress(req, res) {
  const { id } = req.params;

  const address = await prisma.address.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!address) {
    return res.status(404).json({ error: "Address not found." });
  }

  await prisma.address.delete({ where: { id } });

  res.json({ message: "Address deleted." });
}

export async function checkDeliveryZone(req, res) {
  const { latitude, longitude } = req.validated;
  const result = isInDeliveryZone(latitude, longitude);
  res.json(result);
}

export async function recheckAddressZone(req, res) {
  const { id } = req.params;

  const address = await prisma.address.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!address) {
    return res.status(404).json({ error: "Address not found." });
  }

  if (address.latitude == null || address.longitude == null) {
    return res.status(400).json({ error: "Address has no coordinates saved. Please delete and re-add it with location detection." });
  }

  const { inZone, distanceKm } = isInDeliveryZone(address.latitude, address.longitude);

  const updated = await prisma.address.update({
    where: { id },
    data: { isInZone: inZone },
  });

  res.json({ address: updated, isInZone: inZone, distanceKm });
}
