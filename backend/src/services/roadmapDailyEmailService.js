const pool = require("../config/db");
const { sendRoadmapDayEmail } = require("./roadmapEmailService");

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
      `SELECT
         lr.id AS roadmap_id,
         lr.title AS roadmap_title,
         lr.current_day,
         u.email AS user_email,
         u.name AS user_name,
         rd.day_number,
         rd.title AS day_title,
         rd.description AS day_description,
         rd.topics
       FROM learning_roadmaps lr
       INNER JOIN users u ON u.id = lr.user_id
       LEFT JOIN roadmap_days rd
         ON rd.roadmap_id = lr.id
         AND rd.day_number = lr.current_day
       WHERE lr.status = $1
       ORDER BY lr.created_at DESC, lr.id`,
      ["active"],
    );
    roadmaps = result.rows;
  } catch {
    throw new Error("Unable to load active roadmaps for daily email processing.");
  }

  for (const roadmap of roadmaps) {
    summary.processed += 1;

    if (roadmap.day_number === null) {
      summary.failed += 1;
      continue;
    }

    let alreadySent;
    try {
      const logResult = await pool.query(
        `SELECT 1
         FROM roadmap_email_logs
         WHERE roadmap_id = $1
           AND day_number = $2
           AND sent_date = CURRENT_DATE
         LIMIT 1`,
        [roadmap.roadmap_id, roadmap.day_number],
      );
      alreadySent = logResult.rowCount > 0;
    } catch {
      summary.failed += 1;
      continue;
    }

    if (alreadySent) {
      summary.skipped += 1;
      continue;
    }

    let topics;
    try {
      topics = JSON.parse(roadmap.topics);
      if (
        !Array.isArray(topics) ||
        !topics.every((topic) => typeof topic === "string")
      ) {
        throw new Error("Invalid topics");
      }
    } catch {
      summary.failed += 1;
      continue;
    }

    try {
      await sendRoadmapDayEmail({
        email: roadmap.user_email,
        name: roadmap.user_name,
        roadmapTitle: roadmap.roadmap_title,
        day: {
          day_number: roadmap.day_number,
          title: roadmap.day_title,
          description: roadmap.day_description,
          topics,
        },
      });
    } catch {
      summary.failed += 1;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO roadmap_email_logs
           (roadmap_id, day_number, sent_date, sent_at)
         VALUES ($1, $2, CURRENT_DATE, CURRENT_TIMESTAMP)
         ON CONFLICT (roadmap_id, day_number, sent_date) DO NOTHING`,
        [roadmap.roadmap_id, roadmap.day_number],
      );
      summary.sent += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}

module.exports = { processRoadmapDailyEmails };
