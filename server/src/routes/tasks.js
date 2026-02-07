const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  assignUser,
  unassignUser,
  addComment,
} = require("../controllers/taskController");

const router = express.Router({ mergeParams: true });

router.get("/", authenticate, requireProjectMember, getTasks);
router.post("/", authenticate, requireProjectMember, createTask);
router.patch("/:taskId", authenticate, requireProjectMember, updateTask);
router.delete("/:taskId", authenticate, requireProjectMember, deleteTask);
router.post("/:taskId/assignees", authenticate, requireProjectMember, assignUser);
router.delete(
  "/:taskId/assignees",
  authenticate,
  requireProjectMember,
  unassignUser
);
router.post("/:taskId/comments", authenticate, requireProjectMember, addComment);

module.exports = router;
