const pool = require("../config/db");
const { getRoadmapUrl } = require("./emailService");
const { sendRoadmapDayEmail } = require("./roadmapEmailService");

async function sendRoadmapEmailOnce({ roadmapId, dayNumber }) {
  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const roadmapResult = await client.query(
      `SELECT id, title, current_day, status
       FROM learning_roadmaps
       WHERE id = $1
       FOR UPDATE`,
      [roadmapId],
    );
    const roadmap = roadmapResult.rows[0];

    if (!roadmap || roadmap.status !== "active") {
      await client.query("COMMIT");
      transactionStarted = false;
      return { sent: false, skipped: true };
    }

    await client.query(
      `SELECT pg_advisory_xact_lock($1::integer, hashtext(CURRENT_DATE::text))`,
      [roadmapId],
    );

    const logResult = await client.query(
      `SELECT 1
       FROM roadmap_email_logs
       WHERE roadmap_id = $1
         AND sent_date = CURRENT_DATE
       LIMIT 1`,
      [roadmapId],
    );
    if (logResult.rowCount > 0) {
      await client.query("COMMIT");
      transactionStarted = false;
      return { sent: false, skipped: true };
    }

    const actualDayNumber = dayNumber ?? roadmap.current_day;
    const dayResult = await client.query(
      `SELECT
         lr.title AS roadmap_title,
         u.email AS user_email,
         u.name AS user_name,
         rd.day_number,
         rd.title AS day_title,
         rd.description AS day_description,
         rd.topics
       FROM learning_roadmaps lr
       INNER JOIN users u ON u.id = lr.user_id
       INNER JOIN roadmap_days rd
         ON rd.roadmap_id = lr.id
         AND rd.day_number = $2
       WHERE lr.id = $1`,
      [roadmapId, actualDayNumber],
    );
    const row = dayResult.rows[0];

    if (!row) {
      throw new Error("The current roadmap day is unavailable.");
    }

    let topics;
    try {
      topics = typeof row.topics === "string" ? JSON.parse(row.topics) : row.topics;
      if (
        !Array.isArray(topics) ||
        !topics.every((topic) => typeof topic === "string")
      ) {
        throw new Error("Invalid roadmap topics.");
      }
    } catch {
      throw new Error("The current roadmap day has invalid topics.");
    }

    await sendRoadmapDayEmail({
      email: row.user_email,
      name: row.user_name,
      roadmapTitle: row.roadmap_title,
      roadmapUrl: getRoadmapUrl(roadmapId),
      isWelcome: actualDayNumber === 1,
      day: {
        day_number: row.day_number,
        title: row.day_title,
        description: row.day_description,
        topics,
      },
    });

    await client.query(
      `INSERT INTO roadmap_email_logs
         (roadmap_id, day_number, sent_date, sent_at)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_TIMESTAMP)
       ON CONFLICT (roadmap_id, day_number, sent_date) DO NOTHING`,
      [roadmapId, actualDayNumber],
    );
    await client.query("COMMIT");
    transactionStarted = false;
    return { sent: true, skipped: false };
  } catch {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Keep the original operation failure as the reported outcome.
      }
    }
    throw new Error("Unable to send the roadmap email.");
  } finally {
    client?.release();
  }
}

async function processRoadmapDailyEmails() {
  const summary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  let roadmaps;
  try {
    const result = await pool.query(
      `SELECT id
       FROM learning_roadmaps
       WHERE status = $1
       ORDER BY created_at DESC, id`,
      ["active"],
    );
    roadmaps = result.rows;
  } catch {
    console.error("Unable to load active roadmaps for daily email processing.");
    throw new Error("Unable to load active roadmaps for daily email processing.");
  }

  for (const roadmap of roadmaps) {
    summary.processed += 1;

    try {
      const result = await sendRoadmapEmailOnce({ roadmapId: roadmap.id });
      if (result.sent) summary.sent += 1;
      else summary.skipped += 1;
    } catch {
      console.error("Daily roadmap email failed.", { roadmapId: roadmap.id });
      summary.failed += 1;
    }
  }

  return summary;
}

module.exports = { processRoadmapDailyEmails, sendRoadmapEmailOnce };
