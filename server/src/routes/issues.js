const express = require("express");
const router = express.Router();
const issueController = require("../controllers/issueController");
const { authenticate } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// Create issue
router.post("/", issueController.createIssue);

// Get issues for project
router.get("/project/:projectId", issueController.getIssues);

// Get single issue
router.get("/:id", issueController.getIssue);

// Update issue status
router.put("/:id/status", issueController.updateStatus);

// Assign issue
router.put("/:id/assign", issueController.assignIssue);

// Add comment to issue
router.post("/:id/comment", issueController.addComment);

module.exports = router;
