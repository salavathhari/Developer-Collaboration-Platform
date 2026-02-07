const AiLog = require("../models/AiLog");
const asyncHandler = require("../utils/asyncHandler");
const { sanitizeString } = require("../utils/sanitize");
const { callAi } = require("../utils/aiClient");
const ApiError = require("../utils/ApiError");

const askAi = asyncHandler(async (req, res) => {
  const prompt = sanitizeString(req.body.prompt || "");
  const projectId = req.body.projectId || null;
  const provider = req.body.provider || process.env.AI_PROVIDER || "openai";

  if (!prompt) {
    throw new ApiError(400, "Prompt is required");
  }

  const start = Date.now();
  const responseText = await callAi({ prompt, provider });
  const latencyMs = Date.now() - start;

  const log = await AiLog.create({
    userId: req.user.id,
    projectId,
    prompt,
    response: responseText,
    provider,
    latencyMs,
  });

  return res.status(200).json({
    response: responseText,
    logId: log.id,
  });
});

const getAiLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const logs = await AiLog.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit);

  return res.status(200).json({ logs });
});

module.exports = {
  askAi,
  getAiLogs,
};
