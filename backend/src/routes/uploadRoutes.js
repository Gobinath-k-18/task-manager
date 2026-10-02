const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const { uploadImage } = require("../controllers/uploadController");

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      const error = new Error("Invalid image file type");
      error.code = "INVALID_FILE_TYPE";
      callback(error);
      return;
    }
    callback(null, true);
  },
});

const router = express.Router();

router.post("/", authMiddleware, upload.single("image"), uploadImage);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ message: "Image must be 5 MB or smaller" });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ message: "Upload one image using the image field" });
    }
    return res.status(400).json({ message: "Unable to process the image upload" });
  }

  if (error?.code === "INVALID_FILE_TYPE") {
    return res.status(415).json({ message: "Only JPG, JPEG, PNG, and WEBP images are allowed" });
  }

  return res.status(500).json({ message: "Unable to process the image upload" });
});

module.exports = router;