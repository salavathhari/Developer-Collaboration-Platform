const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    relatedPR: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PullRequest",
      default: null,
      index: true,
    },
    relatedChatMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    visibility: {
      type: String,
      enum: ["project", "private"],
      default: "project",
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
attachmentSchema.index({ projectId: 1, relatedTask: 1 });
attachmentSchema.index({ projectId: 1, relatedPR: 1 });
attachmentSchema.index({ projectId: 1, relatedChatMessage: 1 });
attachmentSchema.index({ uploadedBy: 1, createdAt: -1 });

// Method to increment version when file is replaced
attachmentSchema.methods.incrementVersion = function () {
  this.version += 1;
  return this.save();
};

// Method to check if user can view this file
attachmentSchema.methods.canUserView = function (userId, projectOwner, projectMembers) {
  if (this.isDeleted) return false;
  
  if (this.visibility === "private") {
    // Private files: only uploader and project owner
    return (
      this.uploadedBy.toString() === userId.toString() ||
      projectOwner.toString() === userId.toString()
    );
  }
  
  // Project files: any project member
  const isMember = projectMembers.some(
    (m) => m.user.toString() === userId.toString()
  );
  return isMember || projectOwner.toString() === userId.toString();
};

// Static method to get files by context
attachmentSchema.statics.findByContext = async function (
  projectId,
  contextType,
  contextId
) {
  const query = { projectId, isDeleted: false };
  
  if (contextType === "task" && contextId) {
    query.relatedTask = contextId;
  } else if (contextType === "pr" && contextId) {
    query.relatedPR = contextId;
  } else if (contextType === "chat" && contextId) {
    query.relatedChatMessage = contextId;
  }
  
  return this.find(query)
    .populate("uploadedBy", "name email avatar")
    .sort({ createdAt: -1 });
};

module.exports = mongoose.model("Attachment", attachmentSchema);
