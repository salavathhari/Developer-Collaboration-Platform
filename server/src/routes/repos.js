const express = require("express");
const router = express.Router();
const repoController = require("../controllers/repoController");
const { authenticate } = require("../middleware/auth");

// ============================================
// GIT-BASED ROUTES (Real Git Integration)
// ============================================

// Initialize Git repository
router.post("/init", authenticate, repoController.initGitRepo);

// List files in repository
router.get("/:projectId/files", authenticate, repoController.listRepoFiles);

// Get file content
router.get("/:projectId/file-content", authenticate, repoController.getFileContent);

// Get commit history
router.get("/:projectId/commits", authenticate, repoController.getCommitHistory);

// Upload file
router.post("/:projectId/upload", authenticate, repoController.uploadFileToRepo);

// Upload multiple files
router.post("/:projectId/upload-multiple", authenticate, repoController.uploadMultipleFiles);

// Create branch
router.post("/:projectId/branch", authenticate, repoController.createGitBranch);

// Get repository stats
router.get("/:projectId/stats", authenticate, repoController.getRepoStats);

// Get latest commit
router.get("/:projectId/latest-commit", authenticate, repoController.getLatestCommit);

// List branches
router.get("/:projectId/branches", authenticate, repoController.listBranches);

// ============================================
// LEGACY MONGODB-BASED ROUTES (Backward Compatibility)
// ============================================

router.post("/create", authenticate, repoController.createRepository);
router.get("/project/:projectId", authenticate, repoController.getRepository);

router.post("/:repoId/commit", authenticate, repoController.commitChanges);
router.get("/:repoId/commits", authenticate, repoController.getCommits);
router.get("/:repoId/files", authenticate, repoController.getRepoFiles);

router.post("/:repoId/branches", authenticate, repoController.createBranch);

module.exports = router;