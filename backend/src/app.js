const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const roadmapRoutes = require("./routes/roadmapRoutes");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://task-manager-eta-jade-35.vercel.app",
    ],
  }),
);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/roadmaps", roadmapRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "Task Manager API is running" });
});

app.get("/api/db-test", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({
      success: true,
      message: "PostgreSQL connected successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "PostgreSQL connection failed",
    });
  }
});

module.exports = app;