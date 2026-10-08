const express = require("express");
const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");
const {
  completeRoadmapDay,
  createRoadmap,
  getRoadmaps,
} = require("../controllers/roadmapController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (file.mimetype !== "application/pdf") {
      const error = new Error("Only PDF files are allowed.");
      error.code = "INVALID_PDF_TYPE";
      callback(error);
      return;
    }

    callback(null, true);
  },
});

const router = express.Router();

router.get("/", authMiddleware, getRoadmaps);
router.patch(
  "/:roadmapId/days/:dayNumber/complete",
  authMiddleware,
  completeRoadmapDay,
);

router.post("/", authMiddleware, (req, res, next) => {
  upload.single("document")(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: "PDF files must be 10 MB or smaller." });
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ message: "Upload one PDF using the document field." });
      }

      return res.status(400).json({ message: "Unable to process the PDF upload." });
    }

    if (error.code === "INVALID_PDF_TYPE") {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  });
}, createRoadmap);

router.use((error, req, res, next) => {
  console.error("Roadmap upload failed:", error);
  return res.status(500).json({ message: "Unable to process the PDF upload." });
});

module.exports = router;
