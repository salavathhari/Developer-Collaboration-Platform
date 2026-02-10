const ChatMessage = require("../models/ChatMessage");
const ReviewComment = require("../models/ReviewComment");
const Presence = require("../models/Presence");
const Project = require("../models/Project");
const { sanitizeString } = require("../utils/sanitize");
const { createNotification, emitNotification } = require("../utils/notify");

/**
 * Setup collaboration-specific socket event handlers
 * For real-time chat, inline PR comments, and live code review
 */
module.exports = function setupCollaborationHandlers(io, socket, userId) {

  // ============= CHAT ROOM EVENTS =============

  /**
   * Join a specific chat room (project/pr/file)
   */
  socket.on("chat:join_room", async ({ projectId, roomType, roomId }) => {
    if (!projectId || !roomType || !roomId) {
      return socket.emit("error", { message: "Missing room parameters" });
    }

    // Verify project membership
    const project = await Project.findById(projectId);
    if (!project) {
      return socket.emit("error", { message: "Project not found" });
    }

    const isMember = project.owner.toString() === userId ||
                     project.members.some(m => m.user.toString() === userId);

    if (!isMember) {
      return socket.emit("error", { message: "Not authorized" });
    }

    const roomName = `chat:${projectId}:${roomType}:${roomId}`;
    socket.join(roomName);

    // Update presence
    await Presence.findOneAndUpdate(
      { projectId, userId },
      {
        projectId,
        userId,
        roomType,
        roomId,
        status: "active",
        lastActivity: new Date(),
      },
      { upsert: true, new: true }
    );

    // Get current room members
    const roomMembers = await Presence.find({
      projectId,
      roomType,
      roomId,
      lastActivity: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // Active in last 5 mins
    }).populate("userId", "name email avatar");

    socket.emit("chat:room_joined", {
      roomName,
      members: roomMembers,
    });

    // Notify others in room
    socket.to(roomName).emit("chat:user_joined", {
      userId,
      roomType,
      roomId,
    });
  });

  /**
   * Leave chat room
   */
  socket.on("chat:leave_room", async ({ projectId, roomType, roomId }) => {
    const roomName = `chat:${projectId}:${roomType}:${roomId}`;
    socket.leave(roomName);

    await Presence.findOneAndUpdate(
      { projectId, userId },
      { status: "away" }
    );

    socket.to(roomName).emit("chat:user_left", {
      userId,
      roomType,
      roomId,
    });
  });

  /**
   * Send chat message (real-time version, complements REST API)
   */
  socket.on("chat:send_message", async ({ projectId, roomType, roomId, text, replyTo }) => {
    if (!projectId || !roomType || !roomId || !text) {
      return socket.emit("error", { message: "Missing message data" });
    }

    try {
      const sanitizedText = sanitizeString(text);
      
      // Use the ChatMessage controller logic or duplicate here
      // For simplicity, creating message directly here
      const message = await ChatMessage.create({
        projectId,
        roomType,
        roomId,
        authorId: userId,
        text: sanitizedText,
        replyTo: replyTo || null,
      });

      await message.populate("authorId", "name email avatar");

      const roomName = `chat:${projectId}:${roomType}:${roomId}`;
      io.to(roomName).emit("chat:new_message", message);

      // Update presence activity
      await Presence.findOneAndUpdate(
        { projectId, userId },
        { lastActivity: new Date() }
      );

    } catch (error) {
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  /**
   * Typing indicator
   */
  socket.on("chat:typing", ({ projectId, roomType, roomId }) => {
    const roomName = `chat:${projectId}:${roomType}:${roomId}`;
    socket.to(roomName).emit("chat:user_typing", { userId });
  });

  socket.on("chat:stop_typing", ({ projectId, roomType, roomId }) => {
    const roomName = `chat:${projectId}:${roomType}:${roomId}`;
    socket.to(roomName).emit("chat:user_stopped_typing", { userId });
  });

  /**
   * Bulk mark messages as read
   */
  socket.on("chat:mark_read", async ({ projectId, roomType, roomId, messageIds }) => {
    if (!messageIds || !messageIds.length) return;

    await ChatMessage.updateMany(
      { _id: { $in: messageIds } },
      { $addToSet: { readBy: userId } }
    );

    const roomName = `chat:${projectId}:${roomType}:${roomId}`;
    io.to(roomName).emit("chat:messages_read", { userId, messageIds });
  });


  // ============= PR INLINE COMMENT EVENTS =============

  /**
   * Add inline comment on PR diff
   */
  socket.on("pr:add_comment", async ({ prId, filePath, lineNumber, content, parentCommentId }) => {
    if (!prId || !filePath || lineNumber === undefined || !content) {
      return socket.emit("error", { message: "Missing comment data" });
    }

    try {
      const comment = await ReviewComment.create({
        pullRequestId: prId,
        author: userId,
        filePath,
        lineNumber,
        content: sanitizeString(content),
        parentCommentId: parentCommentId || null,
      });

      await comment.populate("author", "name email avatar");

      // Emit to PR room
      io.to(`pr:${prId}`).emit("pr:comment_added", comment);

    } catch (error) {
      socket.emit("error", { message: "Failed to add comment" });
    }
  });

  /**
   * Resolve/unresolve comment thread
   */
  socket.on("pr:resolve_comment", async ({ prId, commentId, resolved }) => {
    try {
      const comment = await ReviewComment.findById(commentId);
      if (!comment) {
        return socket.emit("error", { message: "Comment not found" });
      }

      comment.resolved = resolved;
      if (resolved) {
        comment.resolvedBy = userId;
        comment.resolvedAt = new Date();
      } else {
        comment.resolvedBy = null;
        comment.resolvedAt = null;
      }

      await comment.save();
      await comment.populate("author resolvedBy", "name email avatar");

      io.to(`pr:${prId}`).emit("pr:comment_resolved", {
        commentId,
        resolved,
        resolvedBy: userId,
        comment,
      });

    } catch (error) {
      socket.emit("error", { message: "Failed to resolve comment" });
    }
  });

  /**
   * Join PR room for live review
   */
  socket.on("pr:join", async ({ prId, projectId }) => {
    socket.join(`pr:${prId}`);

    // Update presence to show user is reviewing this PR
    await Presence.findOneAndUpdate(
      { projectId, userId },
      {
        projectId,
        userId,
        roomType: "pr",
        roomId: prId,
        status: "active",
        lastActivity: new Date(),
      },
      { upsert: true, new: true }
    );

    // Get active reviewers
    const reviewers = await Presence.find({
      projectId,
      roomType: "pr",
      roomId: prId,
      lastActivity: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
    }).populate("userId", "name email avatar");

    socket.emit("pr:reviewers", { prId, reviewers });
    socket.to(`pr:${prId}`).emit("pr:reviewer_joined", { userId, prId });
  });

  /**
   * Leave PR room
   */
  socket.on("pr:leave", ({ prId }) => {
    socket.leave(`pr:${prId}`);
    socket.to(`pr:${prId}`).emit("pr:reviewer_left", { userId, prId });
  });


  // ============= LIVE CODE REVIEW EVENTS =============

  /**
   * Sync cursor position during live review
   */
  socket.on("review:cursor_move", ({ prId, filePath, lineNumber }) => {
    socket.to(`pr:${prId}`).emit("review:cursor_update", {
      userId,
      filePath,
      lineNumber,
    });

    // Update presence with current file/line
    Presence.findOneAndUpdate(
      { userId },
      {
        currentFile: filePath,
        currentLine: lineNumber,
        lastActivity: new Date(),
      }
    ).catch(() => {});
  });

  /**
   * Start live review session
   */
  socket.on("review:start_session", async ({ prId, projectId }) => {
    const roomName = `review:${prId}`;
    socket.join(roomName);

    await Presence.findOneAndUpdate(
      { projectId, userId },
      {
        projectId,
        userId,
        roomType: "review",
        roomId: prId,
        status: "active",
        lastActivity: new Date(),
      },
      { upsert: true, new: true }
    );

    socket.to(`pr:${prId}`).emit("review:session_started", { userId, prId });
  });

  /**
   * End live review session
   */
  socket.on("review:end_session", async ({ prId }) => {
    socket.leave(`review:${prId}`);
    await Presence.findOneAndUpdate(
      { userId },
      { status: "away", currentFile: null, currentLine: null }
    );

    socket.to(`pr:${prId}`).emit("review:session_ended", { userId, prId });
  });


  // ============= PRESENCE UPDATES =============

  /**
   * Heartbeat to keep presence alive
   */
  socket.on("presence:heartbeat", async ({ projectId }) => {
    await Presence.findOneAndUpdate(
      { projectId, userId },
      { lastActivity: new Date() }
    );
  });

  /**
   * Explicit status change (active/away/busy)
   */
  socket.on("presence:status", async ({ projectId, status }) => {
    if (!["active", "away", "busy"].includes(status)) return;

    await Presence.findOneAndUpdate(
      { projectId, userId },
      { status, lastActivity: new Date() }
    );

    io.to(projectId).emit("presence:status_changed", {
      userId,
      status,
    });
  });

  // Cleanup on disconnect
  socket.on("disconnecting", async () => {
    // Set all user presence to away
    await Presence.updateMany(
      { userId },
      { status: "away" }
    );
  });

};
