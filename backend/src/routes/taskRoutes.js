const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  updateTask,
} = require("../controllers/taskController");

const router = express.Router();

router.use(authMiddleware);
router.get("/", getTasks);
router.post("/", createTask);
router.get("/:id", getTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

module.exports = router;