const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { chatWithAssistant } = require("../controllers/assistantController");

const router = express.Router();

router.post("/chat", authMiddleware, chatWithAssistant);

module.exports = router;
