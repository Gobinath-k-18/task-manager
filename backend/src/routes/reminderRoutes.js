const express = require("express");
const cronAuthMiddleware = require("../middleware/cronAuthMiddleware");
const { sendDueDateReminders } = require("../controllers/reminderController");

const router = express.Router();

router.get("/due-date", cronAuthMiddleware, sendDueDateReminders);

module.exports = router;
