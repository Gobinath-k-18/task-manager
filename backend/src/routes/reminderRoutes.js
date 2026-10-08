const express = require("express");
const cronAuthMiddleware = require("../middleware/cronAuthMiddleware");
const roadmapCronAuthMiddleware = require("../middleware/roadmapCronAuthMiddleware");
const {
  sendDueDateReminders,
  sendRoadmapDailyEmails,
} = require("../controllers/reminderController");

const router = express.Router();

router.get("/due-date", cronAuthMiddleware, sendDueDateReminders);
router.get("/roadmap-daily", roadmapCronAuthMiddleware, sendRoadmapDailyEmails);
router.post("/roadmap-daily", roadmapCronAuthMiddleware, sendRoadmapDailyEmails);

module.exports = router;
