const Message = require("../models/Message");
const ChatSummary = require("../models/ChatSummary");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { callAi } = require("../utils/aiClient");
const logger = require("../utils/logger");

const summarizeChat = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const provider = req.body.provider || process.env.AI_PROVIDER || "openai";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const store = Boolean(req.body.store);

  const messages = await Message.find({ projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderId", "name email");

  if (messages.length === 0) {
    throw new ApiError(404, "No messages to summarize");
  }

  const ordered = messages.slice().reverse();
  const prompt = ordered
    .map((message) => {
      const author = message.senderId?.name || "User";
      return `${author}: ${message.content}`;
    })
    .join("\n");

  const instruction =
    "Summarize the following project chat. Provide bullet points, key decisions, blockers, and next steps.";
  let responseText = "";
  let fallback = false;
  try {
    responseText = await callAi({
      prompt: `${instruction}\n\n${prompt}`,
      provider,
    });
  } catch (error) {
    fallback = true;
    logger.error({ message: error.message, provider }, "AI summary failure");
    responseText = "AI summary unavailable. Please retry in a few minutes.";
  }

  let summaryRecord = null;
  if (store && !fallback) {
    summaryRecord = await ChatSummary.create({
      projectId,
      createdBy: req.user.id,
      summary: responseText,
      messageIds: ordered.map((message) => message.id),
      provider,
      model,
    });
  }

  return res.status(200).json({
    summary: responseText,
    summaryId: summaryRecord ? summaryRecord.id : null,
    fallback,
  });
});

module.exports = {
  summarizeChat,
};
