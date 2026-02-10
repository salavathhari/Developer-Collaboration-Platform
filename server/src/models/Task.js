const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const activityEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "created",
        "updated",
        "status_changed",
        "assigned",
        "pr_linked",
        "file_linked",
        "chat_linked",
        "comment_added",
        "moved",
        "completed",
      ],
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
    },
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
    },
    url: {
      type: String,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "blocked", "done"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
      index: true,
    },
    dueDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    labels: [
      {
        type: String,
        trim: true,
      },
    ],
    attachments: [attachmentSchema],
    comments: [commentSchema],
    commentsCount: {
      type: Number,
      default: 0,
    },
    // Workflow Integration
    linkedPRId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PullRequest",
      default: null,
      index: true,
    },
    linkedIssueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      default: null,
    },
    linkedFiles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],
    linkedChatThreads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ChatMessage",
      },
    ],
    // Kanban Board fields
    columnId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Column",
      default: null,
      index: true,
    },
    orderKey: {
      type: Number,
      default: 0,
      index: true,
    },
    // Legacy order field for backward compatibility
    order: {
      type: Number,
      default: 0,
    },
    // Activity history (optional embedded for quick audit)
    activity: [activityEntrySchema],
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, assignedTo: 1 });
taskSchema.index({ projectId: 1, assignees: 1 });
taskSchema.index({ projectId: 1, priority: 1 });
taskSchema.index({ projectId: 1, columnId: 1, orderKey: 1 });
taskSchema.index({ projectId: 1, status: 1, orderKey: 1 });
taskSchema.index({ linkedPRId: 1 });
taskSchema.index({ linkedFiles: 1 });

// Instance methods
taskSchema.methods.addActivity = function (actorId, type, payload = {}) {
  this.activity.push({
    type,
    actorId,
    payload,
    createdAt: new Date(),
  });
  
  // Keep only last 100 activities to prevent unbounded growth
  if (this.activity.length > 100) {
    this.activity = this.activity.slice(-100);
  }
};

taskSchema.methods.linkPR = async function (prId) {
  const PullRequest = mongoose.model("PullRequest");
  const pr = await PullRequest.findById(prId);
  
  if (!pr) {
    throw new Error("Pull request not found");
  }
  
  if (pr.projectId.toString() !== this.projectId.toString()) {
    throw new Error("Pull request must belong to the same project as the task");
  }
  
  this.linkedPRId = prId;
  return this;
};

taskSchema.methods.linkFile = async function (fileId) {
  const File = mongoose.model("File");
  const file = await File.findById(fileId);
  
  if (!file) {
    throw new Error("File not found");
  }
  
  if (file.projectId.toString() !== this.projectId.toString()) {
    throw new Error("File must belong to the same project as the task");
  }
  
  if (!this.linkedFiles.includes(fileId)) {
    this.linkedFiles.push(fileId);
  }
  
  return this;
};

taskSchema.methods.moveToStatus = async function (newStatus, options = {}) {
  const oldStatus = this.status;
  
  // Validation rules for status transitions
  if (newStatus === "review") {
    // Moving to review requires either a linked PR or at least one assignee
    const requirePR = options.requirePRForReview !== false;
    if (requirePR && !this.linkedPRId && this.assignees.length === 0) {
      throw new Error("Cannot move to review without a linked PR or assignees");
    }
  }
  
  if (newStatus === "done") {
    // Optionally require PR to be merged before marking task as done
    if (options.requireMergedPRForDone && this.linkedPRId) {
      const PullRequest = mongoose.model("PullRequest");
      const pr = await PullRequest.findById(this.linkedPRId);
      if (pr && pr.status !== "merged") {
        throw new Error("Cannot complete task: linked PR is not merged");
      }
    }
  }
  
  this.status = newStatus;
  
  return { oldStatus, newStatus };
};

module.exports = mongoose.model("Task", taskSchema);
