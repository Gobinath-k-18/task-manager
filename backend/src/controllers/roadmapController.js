const pool = require("../config/db");
const { extractPdfText } = require("../services/pdfTextExtractor");
const { generateRoadmapFromText } = require("../services/roadmapAiService");

async function getRoadmaps(req, res) {
  if (!Number.isSafeInteger(req.userId) || req.userId < 1) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const result = await pool.query(
      `SELECT
         lr.id,
         lr.title,
         lr.description,
         lr.current_day,
         lr.total_days,
         lr.status,
         lr.created_at,
         rd.id AS day_id,
         rd.day_number,
         rd.title AS day_title,
         rd.description AS day_description,
         rd.topics,
         rd.status AS day_status,
         rd.completed_at
       FROM learning_roadmaps lr
       LEFT JOIN roadmap_days rd ON rd.roadmap_id = lr.id
       WHERE lr.user_id = $1
       ORDER BY lr.created_at DESC, rd.day_number ASC`,
      [req.userId],
    );

    const roadmapMap = new Map();
    for (const row of result.rows) {
      let roadmap = roadmapMap.get(row.id);
      if (!roadmap) {
        roadmap = {
          id: row.id,
          title: row.title,
          description: row.description,
          current_day: row.current_day,
          total_days: row.total_days,
          status: row.status,
          created_at: row.created_at,
          days: [],
        };
        roadmapMap.set(row.id, roadmap);
      }

      if (row.day_id !== null) {
        let topics;
        try {
          topics = row.topics ? JSON.parse(row.topics) : [];
        } catch (error) {
          throw new Error(`Roadmap day ${row.day_id} has invalid topics JSON.`, {
            cause: error,
          });
        }

        if (!Array.isArray(topics)) {
          throw new Error(`Roadmap day ${row.day_id} topics must be a JSON array.`);
        }

        roadmap.days.push({
          id: row.day_id,
          day_number: row.day_number,
          title: row.day_title,
          description: row.day_description,
          topics,
          status: row.day_status,
          completed_at: row.completed_at,
        });
      }
    }

    return res.json({ roadmaps: Array.from(roadmapMap.values()) });
  } catch (error) {
    console.error("Roadmap retrieval failed:", error);
    return res.status(500).json({ message: "Unable to load roadmaps." });
  }
}

async function completeRoadmapDay(req, res) {
  if (!Number.isSafeInteger(req.userId) || req.userId < 1) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const roadmapId = Number(req.params.roadmapId);
  const dayNumber = Number(req.params.dayNumber);
  if (
    !/^[1-9]\d*$/.test(req.params.roadmapId) ||
    !Number.isSafeInteger(roadmapId) ||
    !/^[1-9]\d*$/.test(req.params.dayNumber) ||
    !Number.isSafeInteger(dayNumber)
  ) {
    return res.status(400).json({ message: "Roadmap ID and day number must be valid positive integers." });
  }

  let client;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const roadmapResult = await client.query(
      `SELECT id, title, description, current_day, total_days, status, created_at
       FROM learning_roadmaps
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [roadmapId, req.userId],
    );
    const roadmap = roadmapResult.rows[0];

    if (!roadmap) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ message: "Roadmap not found." });
    }

    if (roadmap.status === "completed") {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({ message: "This roadmap is already completed." });
    }

    if (dayNumber !== roadmap.current_day) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(400).json({
        message: `Only the current day (day ${roadmap.current_day}) can be completed.`,
      });
    }

    const completedDayResult = await client.query(
      `UPDATE roadmap_days
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE roadmap_id = $1 AND day_number = $2
       RETURNING id, day_number, title, description, topics, status, completed_at`,
      [roadmapId, dayNumber],
    );
    const completedDay = completedDayResult.rows[0];

    if (!completedDay) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ message: "The current roadmap day was not found." });
    }

    let updatedRoadmap;
    let nextDay = null;

    if (dayNumber < roadmap.total_days) {
      const updatedRoadmapResult = await client.query(
        `UPDATE learning_roadmaps
         SET current_day = current_day + 1, status = 'active'
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, description, current_day, total_days, status, created_at`,
        [roadmapId, req.userId],
      );
      updatedRoadmap = updatedRoadmapResult.rows[0];

      const nextDayResult = await client.query(
        `UPDATE roadmap_days
         SET status = 'in_progress'
         WHERE roadmap_id = $1 AND day_number = $2
         RETURNING id, day_number, title, description, topics, status, completed_at`,
        [roadmapId, updatedRoadmap.current_day],
      );
      nextDay = nextDayResult.rows[0];

      if (!nextDay) {
        throw new Error(`Next roadmap day ${updatedRoadmap.current_day} was not found.`);
      }
    } else {
      const updatedRoadmapResult = await client.query(
        `UPDATE learning_roadmaps
         SET status = 'completed'
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, description, current_day, total_days, status, created_at`,
        [roadmapId, req.userId],
      );
      updatedRoadmap = updatedRoadmapResult.rows[0];
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.json({
      message:
        updatedRoadmap.status === "completed"
          ? "Roadmap completed successfully."
          : `Day ${dayNumber} completed. Day ${updatedRoadmap.current_day} is now in progress.`,
      roadmap: updatedRoadmap,
      current_day: updatedRoadmap.current_day,
      completed_day: completedDay,
      next_day: nextDay,
    });
  } catch (error) {
    console.error("Roadmap day completion failed:", error);

    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Roadmap day completion rollback failed:", rollbackError);
      }
    }

    return res.status(500).json({ message: "Unable to complete the roadmap day." });
  } finally {
    client?.release();
  }
}

async function createRoadmap(req, res) {
  if (!Number.isSafeInteger(req.userId) || req.userId < 1) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Please upload a PDF using the document field." });
  }

  if (req.file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return res.status(400).json({ message: "The uploaded file is not a valid PDF." });
  }

  let text;
  try {
    text = await extractPdfText(req.file.buffer);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to read the uploaded PDF.";
    return res.status(400).json({ message });
  }

  let roadmap;
  try {
    roadmap = await generateRoadmapFromText(text);
  } catch (error) {
    console.error("Roadmap generation failed:", error);
    return res.status(502).json({
      message: "Unable to generate a roadmap from the uploaded PDF.",
    });
  }

  let client;
  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const roadmapResult = await client.query(
      `INSERT INTO learning_roadmaps
         (user_id, title, description, total_days, current_day, status)
       VALUES ($1, $2, $3, $4, 1, 'active')
       RETURNING id, title, description, total_days, current_day, status`,
      [req.userId, roadmap.title, roadmap.description, roadmap.days.length],
    );
    const createdRoadmap = roadmapResult.rows[0];

    const days = [];
    for (const day of roadmap.days) {
      const dayResult = await client.query(
        `INSERT INTO roadmap_days
           (roadmap_id, day_number, title, description, topics)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, day_number, title, description, status, completed_at, created_at`,
        [
          createdRoadmap.id,
          day.day_number,
          day.title,
          day.description,
          JSON.stringify(day.topics),
        ],
      );

      days.push({ ...dayResult.rows[0], topics: day.topics });
    }

    await client.query("COMMIT");
    transactionCommitted = true;

    return res.status(201).json({
      ...createdRoadmap,
      days,
    });
  } catch (error) {
    console.error("Roadmap database transaction failed:", error);

    if (client && transactionStarted && !transactionCommitted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Roadmap database transaction rollback failed:", rollbackError);
      }
    }

    return res.status(500).json({ message: "Unable to save the learning roadmap." });
  } finally {
    client?.release();
  }
}

module.exports = { completeRoadmapDay, createRoadmap, getRoadmaps };
