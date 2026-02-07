const express = require("express");

const { authenticate } = require("../middleware/auth");
const { askAi, getAiLogs } = require("../controllers/aiController");

const router = express.Router();

router.post("/query", authenticate, askAi);
router.get("/logs", authenticate, getAiLogs);

module.exports = router;
