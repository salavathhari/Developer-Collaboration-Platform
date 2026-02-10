const express = require("express");
const router = express.Router();
const prController = require("../controllers/prController");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, prController.getPullRequests);
router.post("/", authenticate, prController.createPullRequest);
router.get("/:id", authenticate, prController.getPullRequestById);
router.get("/:id/diff", authenticate, prController.getPullRequestDiff);
router.get("/:id/file", authenticate, prController.getPullRequestFile);
router.put("/:id", authenticate, prController.updatePullRequest);
router.post("/:id/approve", authenticate, prController.approvePullRequest);
router.put("/:id/reject", authenticate, prController.rejectPullRequest);
router.post("/:id/merge", authenticate, prController.mergePullRequest);

// Comments
router.get("/:id/comments", authenticate, prController.getComments);
router.post("/:id/comments", authenticate, prController.createComment);

// Commit History
router.get("/:id/commits", authenticate, prController.getCommitHistory);

// Branch management
router.get("/branches/list", authenticate, prController.getBranches);
router.post("/branches/create", authenticate, prController.createBranch);

module.exports = router;
