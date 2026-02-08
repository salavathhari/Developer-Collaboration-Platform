const express = require("express");
const router = express.Router();
const prController = require("../controllers/prController");
const { authenticate } = require("../middleware/auth");

router.get("/", authenticate, prController.getPullRequests);
router.post("/", authenticate, prController.createPullRequest);
router.get("/:id", authenticate, prController.getPullRequestById);
router.put("/:id", authenticate, prController.updatePullRequest);
router.put("/:id/merge", authenticate, prController.mergePullRequest);

// Comments
router.get("/:id/comments", authenticate, prController.getComments);
router.post("/:id/comments", authenticate, prController.createComment);

module.exports = router;
