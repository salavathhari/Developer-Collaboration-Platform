const Message = require("../models/Message");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sanitizeString, sanitizeRichText } = require("../utils/sanitize");
const { logActivity } = require("../utils/activity");

const getMessages = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit || 30), 100);
  const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

  const query = { projectId };
  if (cursor) {
    query.createdAt = { $lt: cursor };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderId", "name email avatar")
    .populate("attachments", "filename url size mimeType");

  const nextCursor = messages.length
    ? messages[messages.length - 1].createdAt
    : null;

  return res.status(200).json({ messages, nextCursor });
});

const createMessage = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const content = sanitizeRichText(req.body.content || "");
  const attachments = Array.isArray(req.body.attachments)
    ? req.body.attachments
    : [];

  if (!content && attachments.length === 0) {
    throw new ApiError(400, "Message content or attachments required");
  }

  const message = await Message.create({
    projectId,
    senderId: req.user.id,
    content,
    attachments,
    readBy: [req.user.id],
  });

  await logActivity({
    projectId,
    actorId: req.user.id,
    type: "messageSent",
    payload: { messageId: message.id },
  });

  return res.status(201).json({ message });
});

module.exports = {
  getMessages,
  createMessage,
};
