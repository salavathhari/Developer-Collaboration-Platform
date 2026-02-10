const ChatMessage = require("../models/ChatMessage");
const Project = require("../models/Project");
const User = require("../models/User");
const { sanitizeString } = require("../utils/sanitize");
const { createNotification,emitNotification } = require("../utils/notify");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

/**
 * Send a chat message
 * POST /api/chat/send
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const { projectId, roomType, roomId, text, replyTo } = req.body;

  if (!projectId || !roomType || !roomId || !text) {
    throw new ApiError(400, "Missing required fields");
  }

  //Verify project membership
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;
  
  if (!isMember) {
    throw new ApiError(403, "Not authorized to send messages in this project");
  }

  // Sanitize and detect mentions
  const sanitizedText = sanitizeString(text);
  const mentions = extractMentions(sanitizedText, project);

  // Create message
  const message = await ChatMessage.create({
    projectId,
    roomType,
    roomId,
    authorId: req.user.id,
    text: sanitizedText,
    mentions,
    replyTo: replyTo || null,
  });

  await message.populate("authorId", "name email avatar");
  
  // Create notifications for mentions
  for (const mentionedUserId of mentions) {
    if (mentionedUserId.toString() !== req.user.id) {
      await createNotification({
        userId: mentionedUserId,
        type: "mention",
        message: `${req.user.name} mentioned you in ${roomType}`,
        projectId,
        referenceId: message._id,
        payload: { link: `/projects/${projectId}/${roomType}/${roomId}` },
      });
    }
  }

  res.status(201).json(message);
});

/**
 * Get chat history
 * GET /api/chat/history
 */
exports.getChatHistory = asyncHandler(async (req, res) => {
  const { projectId, roomType, roomId, limit = 50, before } = req.query;

  if (!projectId || !roomType || !roomId) {
    throw new ApiError(400, "Missing required query parameters");
  }

  // Verify membership
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  const query = {
    projectId,
    roomType,
    roomId,
    deleted: false,
  };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .populate("authorId", "name email avatar")
    .populate("replyTo", "text authorId");

  res.json({
    messages: messages.reverse(),
    hasMore: messages.length === parseInt(limit),
  });
});

/**
 * Mark messages as read
 * POST /api/chat/read
 */
exports.markMessagesRead = asyncHandler(async (req, res) => {
  const { projectId, roomType, roomId } = req.body;

  if (!projectId || !roomType || !roomId) {
    throw new ApiError(400, "Missing required fields");
  }

  const messages = await ChatMessage.updateMany(
    {
      projectId,
      roomType,
      roomId,
      deleted: false,
      "readBy.userId": { $ne: req.user.id },
    },
    {
      $push: {
        readBy: {
          userId: req.user.id,
          readAt: new Date(),
        },
      },
    }
  );

  res.json({ success: true, updated: messages.modifiedCount });
});

/**
 * Delete a message
 * DELETE /api/chat/:messageId
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const message = await ChatMessage.findById(messageId);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  // Only author or project owner can delete
  const project = await Project.findById(message.projectId);
  const canDelete = message.authorId.toString() === req.user.id ||
                    project.owner.toString() === req.user.id;

  if (!canDelete) {
    throw new ApiError(403, "Not authorized to delete this message");
  }

  message.deleted = true;
  message.text = "[Message deleted]";
  await message.save();

  res.json({ success: true });
});

/**
 * Edit a message
 * PUT /api/chat/:messageId
 */
exports.editMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body;

  if (!text) {
    throw new ApiError(400, "Text is required");
  }

  const message = await ChatMessage.findById(messageId);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (message.authorId.toString() !== req.user.id) {
    throw new ApiError(403, "Not authorized to edit this message");
  }

  // Check if message is older than 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (message.createdAt < fifteenMinutesAgo) {
    throw new ApiError(403, "Cannot edit messages older than 15 minutes");
  }

  message.text = sanitizeString(text);
  message.edited = true;
  await message.save();

  await message.populate("authorId", "name email avatar");

  res.json(message);
});

// Helper function to extract @mentions
function extractMentions(text, project) {
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  const mentionedUserIds = [];

  for (const match of matches) {
    const username = match[1];
    // Find user in project members
    const member = project.members.find(m => 
      m.user.name && m.user.name.toLowerCase() === username.toLowerCase()
    );
    
    if (member && !mentionedUserIds.includes(member.user._id)) {
      mentionedUserIds.push(member.user._id);
    }
  }

  return mentionedUserIds;
}

module.exports = exports;
