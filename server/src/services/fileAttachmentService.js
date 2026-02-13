const File = require("../models/File");
const Task = require("../models/Task");
const PullRequest = require("../models/PullRequest");
const Message = require("../models/Message");
const User = require("../models/User");
const notificationService = require("./notificationService");

/**
 * File Attachment Integration Service
 * Manages file attachments across tasks, PRs, and chat
 */

class FileAttachmentService {
  /**
   * Attach file to a task
   */
  async attachToTask({ fileId, taskId, userId }) {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Check if file already attached
    const alreadyAttached = task.attachments.some(
      (att) => att.fileId && att.fileId.toString() === fileId
    );

    if (alreadyAttached) {
      return { task, alreadyAttached: true };
    }

    // Add attachment
    task.attachments.push({
      fileId: file._id,
      name: file.name,
      size: file.size,
      url: file.path || file.url,
      uploadedBy: userId,
      uploadedAt: new Date(),
    });

    task.addActivity(userId, "file_linked", {
      fileId,
      fileName: file.name,
    });

    await task.save();

    // Update file metadata
    file.attachedTo = file.attachedTo || [];
    if (!file.attachedTo.some((att) => att.type === "task" && att.id.toString() === taskId)) {
      file.attachedTo.push({
        type: "task",
        id: taskId,
        title: task.title,
      });
      await file.save();
    }

    // Notify watchers
    const watchers = [
      ...task.assignees.map((a) => (typeof a === "object" ? a._id : a)),
      task.createdBy,
    ];

    await notificationService.notifyFileUploaded({
      fileId,
      fileName: file.name,
      uploaderId: userId,
      projectId: task.projectId,
      attachedTo: { type: "task", title: task.title },
      watchers,
    });

    return { task, file, alreadyAttached: false };
  }

  /**
   * Attach file to a pull request
   */
  async attachToPR({ fileId, prId, userId }) {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    const pr = await PullRequest.findById(prId).populate("author reviewers");
    if (!pr) {
      throw new Error("Pull request not found");
    }

    // Update file metadata
    file.attachedTo = file.attachedTo || [];
    if (!file.attachedTo.some((att) => att.type === "pr" && att.id.toString() === prId)) {
      file.attachedTo.push({
        type: "pr",
        id: prId,
        title: `PR #${pr.number}: ${pr.title}`,
      });
      await file.save();
    }

    // Notify PR participants
    const watchers = [
      pr.author._id || pr.author,
      ...(pr.reviewers || []).map((r) => (typeof r === "object" ? r._id : r)),
    ];

    await notificationService.notifyFileUploaded({
      fileId,
      fileName: file.name,
      uploaderId: userId,
      projectId: pr.projectId,
      attachedTo: { type: "pr", number: pr.number, title: pr.title },
      watchers,
    });

    return { pr, file };
  }

  /**
   * Attach file to a message (already handled in Message model, but can add notifications)
   */
  async attachToMessage({ fileId, messageId, userId }) {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Update file metadata
    file.attachedTo = file.attachedTo || [];
    if (!file.attachedTo.some((att) => att.type === "message" && att.id.toString() === messageId)) {
      file.attachedTo.push({
        type: "message",
        id: messageId,
        title: "Chat message",
      });
      await file.save();
    }

    return { message, file };
  }

  /**
   * Get all files attached to a specific entity
   */
  async getAttachments({ entityType, entityId }) {
    const query = {
      attachedTo: {
        $elemMatch: {
          type: entityType,
          id: entityId,
        },
      },
    };

    const files = await File.find(query)
      .populate("uploadedBy", "name email avatar")
      .sort({ uploadedAt: -1 });

    return files;
  }

  /**
   * Get file usage info (where it's attached)
   */
  async getFileUsage(fileId) {
    const file = await File.findById(fileId).populate("uploadedBy", "name email avatar");
    if (!file) {
      throw new Error("File not found");
    }

    const usage = {
      file,
      attachments: file.attachedTo || [],
      tasks: [],
      pullRequests: [],
      messages: [],
    };

    // Get detailed attachment info
    if (file.attachedTo && file.attachedTo.length > 0) {
      const taskIds = file.attachedTo.filter((a) => a.type === "task").map((a) => a.id);
      const prIds = file.attachedTo.filter((a) => a.type === "pr").map((a) => a.id);
      const messageIds = file.attachedTo.filter((a) => a.type === "message").map((a) => a.id);

      if (taskIds.length > 0) {
        usage.tasks = await Task.find({ _id: { $in: taskIds } }).select(
          "title status priority assignees"
        );
      }

      if (prIds.length > 0) {
        usage.pullRequests = await PullRequest.find({ _id: { $in: prIds } }).select(
          "number title status author"
        );
      }

      if (messageIds.length > 0) {
        usage.messages = await Message.find({ _id: { $in: messageIds } }).select(
          "senderId content createdAt"
        );
      }
    }

    return usage;
  }

  /**
   * Remove file attachment from entity
   */
  async detachFile({ fileId, entityType, entityId, userId }) {
    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    // Remove from file's attachedTo array
    if (file.attachedTo) {
      file.attachedTo = file.attachedTo.filter(
        (att) => !(att.type === entityType && att.id.toString() === entityId)
      );
      await file.save();
    }

    // Remove from entity (if applicable)
    if (entityType === "task") {
      const task = await Task.findById(entityId);
      if (task) {
        task.attachments = task.attachments.filter(
          (att) => !(att.fileId && att.fileId.toString() === fileId)
        );
        task.addActivity(userId, "file_unlinked", { fileId, fileName: file.name });
        await task.save();
      }
    }

    return { success: true, file };
  }

  /**
   * Search files across project with filters
   */
  async searchFiles({ projectId, query, filters = {} }) {
    const searchQuery = { projectId };

    // Text search
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: "i" } },
        { "attachedTo.title": { $regex: query, $options: "i" } },
      ];
    }

    // Filter by attachment type
    if (filters.attachedTo) {
      searchQuery["attachedTo.type"] = filters.attachedTo;
    }

    // Filter by uploader
    if (filters.uploadedBy) {
      searchQuery.uploadedBy = filters.uploadedBy;
    }

    // Date range
    if (filters.uploadedAfter) {
      searchQuery.uploadedAt = searchQuery.uploadedAt || {};
      searchQuery.uploadedAt.$gte = new Date(filters.uploadedAfter);
    }

    if (filters.uploadedBefore) {
      searchQuery.uploadedAt = searchQuery.uploadedAt || {};
      searchQuery.uploadedAt.$lte = new Date(filters.uploadedBefore);
    }

    const files = await File.find(searchQuery)
      .populate("uploadedBy", "name email avatar")
      .sort({ uploadedAt: -1 })
      .limit(filters.limit || 50);

    return files;
  }
}

module.exports = new FileAttachmentService();
