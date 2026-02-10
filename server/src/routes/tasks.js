const express = require("express");
const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const {
  getTasks,
  getTask,
  getTaskAnalytics,
  createTask,
  updateTask,
  deleteTask,
  linkPR,
  linkFile,
  addComment,
  moveTask,
  bulkUpdateTasks,
  addAttachment,
  uploadAttachment,
} = require("../controllers/taskController");

const router = express.Router({ mergeParams: true });

// Analytics (must be before /:taskId routes)
router.get("/analytics", authenticate, requireProjectMember, getTaskAnalytics);

// Bulk operations (must be before /:taskId routes)
router.post("/bulk-update", authenticate, bulkUpdateTasks);

// CRUD
router.get("/", authenticate, requireProjectMember, getTasks);
router.post("/", authenticate, requireProjectMember, createTask);
router.get("/:taskId", authenticate, requireProjectMember, getTask);
router.put("/:taskId", authenticate, requireProjectMember, updateTask);
router.delete("/:taskId", authenticate, requireProjectMember, deleteTask);

// Task operations
router.post("/:taskId/link-pr", authenticate, requireProjectMember, linkPR);
router.post("/:taskId/link-file", authenticate, requireProjectMember, linkFile);
router.post("/:taskId/move", authenticate, requireProjectMember, moveTask);

// Sub-resources
router.post("/:taskId/comments", authenticate, requireProjectMember, addComment);
router.post(
  "/:taskId/attachments",
  authenticate,
  requireProjectMember,
  uploadAttachment,
  addAttachment
);

module.exports = router;
