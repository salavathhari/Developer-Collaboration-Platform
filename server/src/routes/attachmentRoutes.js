const express = require("express");
const router = express.Router();
const attachmentController = require("../controllers/attachmentController");
const { authenticate } = require("../middleware/auth");
const { handleFileUpload } = require("../middleware/uploadMiddleware");

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/attachments/upload
 * @desc    Upload a file and attach to project/task/PR/chat
 * @access  Private (project members only)
 */
router.post("/upload", handleFileUpload("file"), attachmentController.uploadFile);

/**
 * @route   GET /api/attachments/project/:projectId
 * @desc    Get all files for a project (optionally filtered by context)
 * @query   context=task|pr|chat&contextId=...
 * @access  Private (project members only)
 */
router.get("/project/:projectId", attachmentController.getProjectFiles);

/**
 * @route   GET /api/attachments/:fileId
 * @desc    Get single file with signed URL
 * @access  Private (visible to authorized users)
 */
router.get("/:fileId", attachmentController.getFile);

/**
 * @route   DELETE /api/attachments/:fileId
 * @desc    Delete a file
 * @access  Private (uploader or project owner only)
 */
router.delete("/:fileId", attachmentController.deleteFile);

/**
 * @route   PUT /api/attachments/:fileId/link
 * @desc    Update file links (attach to different context)
 * @access  Private (project members only)
 */
router.put("/:fileId/link", attachmentController.updateFileLinks);

/**
 * @route   POST /api/attachments/:fileId/replace
 * @desc    Replace file content (increment version)
 * @access  Private (uploader only)
 */
router.post("/:fileId/replace", handleFileUpload("file"), attachmentController.replaceFile);

module.exports = router;
