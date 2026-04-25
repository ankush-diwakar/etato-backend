import multer from "multer";
import path from "path";
import crypto from "crypto";

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Route passes dynamic folder via req.uploadPath or defaults to 'uploads'
    cb(null, req.uploadPath || "uploads");
  },
  filename: (req, file, cb) => {
    // Generate unique filename: <random-hash>-<timestamp>.<ext>
    const hash = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${hash}-${Date.now()}${ext}`);
  },
});

// File filter (images only)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."), false);
  }
};

// Multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Middleware to set upload path dynamically
export const setUploadPath = (folder) => (req, res, next) => {
  req.uploadPath = `uploads/${folder}`;
  next();
};
