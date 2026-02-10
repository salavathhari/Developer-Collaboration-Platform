const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const { authenticate } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// Create inline comment on PR
router.post("/pr/:prId/comment", commentController.createComment);

// Get all comments for a PR
router.get("/pr/:prId/comments", commentController.getComments);

// Resolve/unresolve comment thread
router.put("/pr/:prId/comment/:commentId/resolve", commentController.resolveComment);

// Edit comment
router.put("/pr/:prId/comment/:commentId", commentController.editComment);

// Delete comment
router.delete("/pr/:prId/comment/:commentId", commentController.deleteComment);

module.exports = router;
