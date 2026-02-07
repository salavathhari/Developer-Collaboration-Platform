const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const { summarizeChat } = require("../controllers/summaryController");

const router = express.Router({ mergeParams: true });

router.post("/", authenticate, requireProjectMember, summarizeChat);

module.exports = router;
