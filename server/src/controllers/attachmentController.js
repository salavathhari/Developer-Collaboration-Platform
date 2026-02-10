const Attachment = require("../models/Attachment");
const Project = require("../models/Project");
const storageService = require("../services/storage/storageService");
const path = require("path");

/**
 * Upload a file and attach to project/task/PR/chat
 * POST /api/attachments/upload
 */
exports.uploadFile = async (req, res) => {
  try {
    const { projectId, relatedTask, relatedPR, relatedChatMessage, visibility } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    if (!req.fileBuffer || !req.fileMeta) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Verify project exists and user is a member
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isMember =
      project.members.some((m) => m.user.toString() === req.user.id) ||
      project.owner.toString() === req.user.id;

    if (!isMember) {
      return res.status(403).json({ message: "Not authorized to upload to this project" });
    }

    // Validate that only one context is provided
    const contexts = [relatedTask, relatedPR, relatedChatMessage].filter(Boolean);
    if (contexts.length > 1) {
      return res.status(400).json({
        message: "File can only be linked to one context (task, PR, or chat message)",
      });
    }

    // Generate storage path
    const destinationPath = `projects/${projectId}/${req.fileMeta.safeName}`;

    // Upload to storage service
    const uploadResult = await storageService.uploadBuffer(
      req.fileBuffer,
      destinationPath,
      req.fileMeta.mimeType
    );

    // Create attachment record
    const attachment = new Attachment({
      name: req.fileMeta.originalName,
      projectId,
      uploadedBy: req.user.id,
      url: uploadResult.url,
      storageKey: uploadResult.storageKey,
      size: uploadResult.size,
      mimeType: uploadResult.mimeType,
      relatedTask: relatedTask || null,
      relatedPR: relatedPR || null,
      relatedChatMessage: relatedChatMessage || null,
      visibility: visibility || "project",
      meta: {
        originalName: req.fileMeta.originalName,
        safeName: req.fileMeta.safeName,
      },
    });

    await attachment.save();
    await attachment.populate("uploadedBy", "name email avatar");

    // Emit socket event
    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`project:${projectId}`).emit("file:uploaded", {
        fileId: attachment._id,
        name: attachment.name,
        uploadedBy: {
          _id: attachment.uploadedBy._id,
          name: attachment.uploadedBy.name,
        },
        size: attachment.size,
        mimeType: attachment.mimeType,
        relatedTask: attachment.relatedTask,
        relatedPR: attachment.relatedPR,
        relatedChatMessage: attachment.relatedChatMessage,
        createdAt: attachment.createdAt,
      });
    }

    res.status(201).json({
      message: "File uploaded successfully",
      attachment,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get files for a project (optionally filtered by context)
 * GET /api/attachments/project/:projectId
 */
exports.getProjectFiles = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { context, contextId } = req.query;

    // Verify project exists and user is a member
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isMember =
      project.members.some((m) => m.user.toString() === req.user.id) ||
      project.owner.toString() === req.user.id;

    if (!isMember) {
      return res.status(403).json({ message: "Not authorized" });
    }

    let attachments;

    if (context && contextId) {
      // Get files for specific context
      attachments = await Attachment.findByContext(projectId, context, contextId);
    } else {
      // Get all project files
      attachments = await Attachment.find({
        projectId,
        isDeleted: false,
      })
        .populate("uploadedBy", "name email avatar")
        .sort({ createdAt: -1 });
    }

    // Filter by visibility permissions
    const filteredAttachments = attachments.filter((att) =>
      att.canUserView(req.user.id, project.owner, project.members)
    );

    res.json({
      attachments: filteredAttachments,
      count: filteredAttachments.length,
    });
  } catch (error) {
    console.error("Error getting project files:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get single file with signed URL
 * GET /api/attachments/:fileId
 */
exports.getFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const attachment = await Attachment.findById(fileId).populate(
      "uploadedBy",
      "name email avatar"
    );

    if (!attachment || attachment.isDeleted) {
      return res.status(404).json({ message: "File not found" });
    }

    // Verify project access
    const project = await Project.findById(attachment.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check visibility permissions
    const canView = attachment.canUserView(req.user.id, project.owner, project.members);
    if (!canView) {
      return res.status(403).json({ message: "Not authorized to view this file" });
    }

    // Generate signed URL for secure access
    const signedUrl = await storageService.getSignedUrl(attachment.storageKey, 300);

    res.json({
      attachment: {
        ...attachment.toObject(),
        signedUrl,
      },
    });
  } catch (error) {
    console.error("Error getting file:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a file
 * DELETE /api/attachments/:fileId
 */
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    const attachment = await Attachment.findById(fileId);
    if (!attachment || attachment.isDeleted) {
      return res.status(404).json({ message: "File not found" });
    }

    // Verify project access
    const project = await Project.findById(attachment.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check permissions: uploader or project owner can delete
    const isUploader = attachment.uploadedBy.toString() === req.user.id;
    const isOwner = project.owner.toString() === req.user.id;

    if (!isUploader && !isOwner) {
      return res.status(403).json({ message: "Not authorized to delete this file" });
    }

    // Delete from storage
    await storageService.delete(attachment.storageKey);

    // Soft delete in database
    attachment.isDeleted = true;
    await attachment.save();

    // Emit socket event
    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`project:${attachment.projectId}`).emit("file:deleted", {
        fileId: attachment._id,
        deletedBy: req.user.id,
      });
    }

    res.json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update file links (attach to different context)
 * PUT /api/attachments/:fileId/link
 */
exports.updateFileLinks = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { relatedTask, relatedPR, relatedChatMessage } = req.body;

    const attachment = await Attachment.findById(fileId);
    if (!attachment || attachment.isDeleted) {
      return res.status(404).json({ message: "File not found" });
    }

    // Verify project access
    const project = await Project.findById(attachment.projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isMember =
      project.members.some((m) => m.user.toString() === req.user.id) ||
      project.owner.toString() === req.user.id;

    if (!isMember) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Validate that only one context is provided
    const contexts = [relatedTask, relatedPR, relatedChatMessage].filter(Boolean);
    if (contexts.length > 1) {
      return res.status(400).json({
        message: "File can only be linked to one context",
      });
    }

    // Update links
    attachment.relatedTask = relatedTask || null;
    attachment.relatedPR = relatedPR || null;
    attachment.relatedChatMessage = relatedChatMessage || null;

    await attachment.save();
    await attachment.populate("uploadedBy", "name email avatar");

    // Emit socket event
    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`project:${attachment.projectId}`).emit("file:linked", {
        fileId: attachment._id,
        relatedTask: attachment.relatedTask,
        relatedPR: attachment.relatedPR,
        relatedChatMessage: attachment.relatedChatMessage,
      });
    }

    res.json({
      message: "File links updated successfully",
      attachment,
    });
  } catch (error) {
    console.error("Error updating file links:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Replace file content (increment version)
 * POST /api/attachments/:fileId/replace
 */
exports.replaceFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!req.fileBuffer || !req.fileMeta) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const attachment = await Attachment.findById(fileId);
    if (!attachment || attachment.isDeleted) {
      return res.status(404).json({ message: "File not found" });
    }

    // Only uploader can replace
    if (attachment.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only uploader can replace files" });
    }

    // Store previous version info
    const previousVersion = {
      version: attachment.version,
      url: attachment.url,
      storageKey: attachment.storageKey,
      size: attachment.size,
      replacedAt: new Date(),
    };

    if (!attachment.meta.versions) {
      attachment.meta.versions = [];
    }
    attachment.meta.versions.push(previousVersion);

    // Upload new version
    const destinationPath = `projects/${attachment.projectId}/${req.fileMeta.safeName}`;
    const uploadResult = await storageService.uploadBuffer(
      req.fileBuffer,
      destinationPath,
      req.fileMeta.mimeType
    );

    // Update attachment
    attachment.name = req.fileMeta.originalName;
    attachment.url = uploadResult.url;
    attachment.storageKey = uploadResult.storageKey;
    attachment.size = uploadResult.size;
    attachment.mimeType = uploadResult.mimeType;
    await attachment.incrementVersion();
    await attachment.populate("uploadedBy", "name email avatar");

    // Delete old version from storage (optional - keep for audit)
    // await storageService.delete(previousVersion.storageKey);

    // Emit socket event
    if (req.app.get("io")) {
      const io = req.app.get("io");
      io.to(`project:${attachment.projectId}`).emit("file:replaced", {
        fileId: attachment._id,
        version: attachment.version,
        replacedBy: req.user.id,
      });
    }

    res.json({
      message: "File replaced successfully",
      attachment,
    });
  } catch (error) {
    console.error("Error replacing file:", error);
    res.status(500).json({ message: error.message });
  }
};
