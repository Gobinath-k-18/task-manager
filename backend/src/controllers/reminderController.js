const { processDueDateReminders } = require("../services/dueDateReminderService");
const { processRoadmapDailyEmails } = require("../services/roadmapDailyEmailService");

async function sendDueDateReminders(req, res) {
  try {
    const summary = await processDueDateReminders();
    return res.json({ message: "Due date reminders processed", ...summary });
  } catch (error) {
    console.error("Unable to process due date reminders:", error);
    return res.status(500).json({ message: "Unable to process due date reminders" });
  }
}

async function sendRoadmapDailyEmails(req, res) {
  try {
    const summary = await processRoadmapDailyEmails();
    return res.status(200).json({
      processed: summary.processed,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
    });
  } catch {
    return res.status(500).json({ message: "Unable to process roadmap daily emails." });
  }
}

module.exports = { sendDueDateReminders, sendRoadmapDailyEmails };
