const { processDueDateReminders } = require("../services/dueDateReminderService");

async function sendDueDateReminders(req, res) {
  try {
    const summary = await processDueDateReminders();
    return res.json({ message: "Due date reminders processed", ...summary });
  } catch (error) {
    console.error("Unable to process due date reminders:", error);
    return res.status(500).json({ message: "Unable to process due date reminders" });
  }
}

module.exports = { sendDueDateReminders };
