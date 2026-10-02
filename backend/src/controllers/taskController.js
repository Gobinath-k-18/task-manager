const pool = require("../config/db");

const allowedStatuses = new Set(["pending", "in_progress", "completed"]);
const editableColumns = {
  title: "title",
  description: "description",
  status: "status",
  due_date: "due_date",
  image_url: "image_url",
};
const taskColumns = "id, title, description, status, due_date, image_url, owner_id";

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateTaskFields(body, { requireTitleAndStatus = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "A task object is required";
  }

  if (requireTitleAndStatus || Object.hasOwn(body, "title")) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return "Title is required";
    }
    if (body.title.trim().length > 255) {
      return "Title must be 255 characters or fewer";
    }
  }

  if (requireTitleAndStatus || Object.hasOwn(body, "status")) {
    if (typeof body.status !== "string" || !allowedStatuses.has(body.status)) {
      return "Status must be pending, in_progress, or completed";
    }
  }

  for (const field of ["description", "image_url"]) {
    if (
      Object.hasOwn(body, field) &&
      body[field] !== null &&
      typeof body[field] !== "string"
    ) {
      return `${field} must be a string or null`;
    }
  }

  if (
    Object.hasOwn(body, "due_date") &&
    body.due_date !== null &&
    body.due_date !== "" &&
    !isValidDate(body.due_date)
  ) {
    return "due_date must be a valid date in YYYY-MM-DD format";
  }

  return null;
}

function getTaskId(req, res) {
  if (!/^\d+$/.test(req.params.id) || Number(req.params.id) < 1) {
    res.status(404).json({ message: "Task not found" });
    return null;
  }
  return req.params.id;
}

async function getTasks(req, res) {
  try {
    const result = await pool.query(
      `SELECT ${taskColumns} FROM tasks WHERE owner_id = $1 ORDER BY id`,
      [req.userId],
    );
    return res.json(result.rows);
  } catch {
    return res.status(500).json({ message: "Unable to retrieve tasks" });
  }
}

async function createTask(req, res) {
  const validationError = validateTaskFields(req.body, {
    requireTitleAndStatus: true,
  });
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const { title, description = null, status, due_date = null, image_url = null } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, description, status, due_date, image_url, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${taskColumns}`,
      [
        title.trim(),
        description,
        status,
        due_date === "" ? null : due_date,
        image_url,
        req.userId,
      ],
    );
    return res.status(201).json(result.rows[0]);
  } catch {
    return res.status(500).json({ message: "Unable to create task" });
  }
}

async function getTask(req, res) {
  const taskId = getTaskId(req, res);
  if (taskId === null) return;

  try {
    const result = await pool.query(
      `SELECT ${taskColumns} FROM tasks WHERE id = $1 AND owner_id = $2`,
      [taskId, req.userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ message: "Unable to retrieve task" });
  }
}

async function updateTask(req, res) {
  const taskId = getTaskId(req, res);
  if (taskId === null) return;

  const validationError = validateTaskFields(req.body, {
    requireTitleAndStatus: true,
  });
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const fields = Object.keys(editableColumns).filter((field) =>
    Object.hasOwn(req.body, field),
  );
  if (fields.length === 0) {
    return res.status(400).json({ message: "At least one task field must be provided" });
  }

  const values = fields.map((field) => {
    const value = req.body[field];
    return field === "title" ? value.trim() : field === "due_date" && value === "" ? null : value;
  });
  const assignments = fields.map(
    (field, index) => `${editableColumns[field]} = $${index + 1}`,
  );
  values.push(taskId, req.userId);

  try {
    const result = await pool.query(
      `UPDATE tasks SET ${assignments.join(", ")}
       WHERE id = $${values.length - 1} AND owner_id = $${values.length}
       RETURNING ${taskColumns}`,
      values,
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json(result.rows[0]);
  } catch {
    return res.status(500).json({ message: "Unable to update task" });
  }
}

async function deleteTask(req, res) {
  const taskId = getTaskId(req, res);
  if (taskId === null) return;

  try {
    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND owner_id = $2 RETURNING id",
      [taskId, req.userId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.json({ message: "Task deleted successfully" });
  } catch {
    return res.status(500).json({ message: "Unable to delete task" });
  }
}

module.exports = { createTask, deleteTask, getTask, getTasks, updateTask };