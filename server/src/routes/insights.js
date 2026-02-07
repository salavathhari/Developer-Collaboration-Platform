const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const {
  generateInsights,
  getLatestInsight,
} = require("../controllers/insightController");

const router = express.Router({ mergeParams: true });

router.get("/latest", authenticate, requireProjectMember, getLatestInsight);
router.post("/generate", authenticate, requireProjectMember, generateInsights);

module.exports = router;
