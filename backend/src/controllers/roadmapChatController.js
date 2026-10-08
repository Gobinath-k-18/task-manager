const pool = require("../config/db");
const { answerRoadmapQuestion } = require("../services/roadmapChatService");

async function chatAboutRoadmap(req, res) {
  if (!Number.isSafeInteger(req.userId) || req.userId < 1) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const roadmapIdParam = req.params.roadmapId;
  if (
    typeof roadmapIdParam !== "string" ||
    !/^[1-9]\d*$/.test(roadmapIdParam) ||
    !Number.isSafeInteger(Number(roadmapIdParam)) ||
    Number(roadmapIdParam) > 2147483647
  ) {
    return res.status(400).json({ message: "Roadmap ID must be a valid positive integer." });
  }

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ message: "A non-empty message is required." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ message: "Message must be 2000 characters or fewer." });
  }

  try {
    const result = await pool.query(
      `SELECT
         lr.id,
         lr.title AS roadmap_title,
         lr.description AS roadmap_description,
         lr.current_day,
         lr.total_days,
         lr.status AS roadmap_status,
         rd.day_number,
         rd.title AS day_title,
         rd.description AS day_description,
         rd.topics AS day_topics,
         rd.status AS day_status
       FROM learning_roadmaps lr
       LEFT JOIN roadmap_days rd
         ON rd.roadmap_id = lr.id
         AND rd.day_number = lr.current_day
       WHERE lr.id = $1 AND lr.user_id = $2`,
      [Number(roadmapIdParam), req.userId],
    );
    const row = result.rows[0];

    if (!row) {
      return res.status(404).json({ message: "Roadmap not found." });
    }
    if (row.day_number === null) {
      return res.status(500).json({ message: "The current roadmap day is unavailable." });
    }

    let topics;
    try {
      topics = row.day_topics ? JSON.parse(row.day_topics) : [];
    } catch {
      return res.status(500).json({ message: "The current roadmap day data is invalid." });
    }
    if (
      !Array.isArray(topics) ||
      !topics.every((topic) => typeof topic === "string")
    ) {
      return res.status(500).json({ message: "The current roadmap day data is invalid." });
    }

    const roadmap = {
      id: row.id,
      title: row.roadmap_title,
      description: row.roadmap_description,
      current_day: row.current_day,
      total_days: row.total_days,
      status: row.roadmap_status,
    };
    const day = {
      day_number: row.day_number,
      title: row.day_title,
      description: row.day_description,
      topics,
      status: row.day_status,
    };

    const answer = await answerRoadmapQuestion({ message, roadmap, day });
    return res.json({
      answer,
      roadmap: {
        id: roadmap.id,
        title: roadmap.title,
        current_day: roadmap.current_day,
        total_days: roadmap.total_days,
      },
      day: {
        day_number: day.day_number,
        title: day.title,
        status: day.status,
      },
    });
  } catch {
    return res.status(500).json({ message: "Unable to process the roadmap chat request." });
  }
}

module.exports = { chatAboutRoadmap };
