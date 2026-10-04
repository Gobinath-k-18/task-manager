const pool = require("../config/db");
const { sendDueDateReminderEmail } = require("./emailService");

async function processDueDateReminders() {
  const result = await pool.query(
    `SELECT t.id, t.title, t.description, t.status, t.due_date,
            u.id AS user_id, u.name, u.email
     FROM tasks t
     INNER JOIN users u ON u.id = t.owner_id
     WHERE t.due_date = CURRENT_DATE + 1
     ORDER BY t.id`,
  );

  const summary = { sent: 0, skipped: 0, failed: 0 };

  for (const task of result.rows) {
    const claim = await pool.query(
      `INSERT INTO due_date_reminders (task_id, due_date)
       VALUES ($1, $2)
       ON CONFLICT (task_id) DO NOTHING
       RETURNING task_id`,
      [task.id, task.due_date],
    );

    if (claim.rowCount === 0) {
      summary.skipped += 1;
      continue;
    }

    try {
      await sendDueDateReminderEmail(task);
    } catch (error) {
      summary.failed += 1;
      console.error(`Due date reminder failed for task ${task.id}:`, error);

      try {
        await pool.query("DELETE FROM due_date_reminders WHERE task_id = $1", [
          task.id,
        ]);
      } catch (cleanupError) {
        console.error(
          `Unable to release due date reminder claim for task ${task.id}:`,
          cleanupError,
        );
      }
      continue;
    }

    try {
      await pool.query(
        `UPDATE due_date_reminders
         SET sent_at = CURRENT_TIMESTAMP
         WHERE task_id = $1`,
        [task.id],
      );
      summary.sent += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `Reminder sent but delivery status could not be recorded for task ${task.id}:`,
        error,
      );
    }
  }

  return summary;
}

module.exports = { processDueDateReminders };
