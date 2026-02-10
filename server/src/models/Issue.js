const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },
  description: {
    type: String,
    maxlength: 5000,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "done", "closed"],
    default: "open",
    index: true,
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  // Context linking
  prId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PullRequest",
  },
  filePath: String,
  lineNumber: Number,
  chatMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChatMessage",
  },
  reviewCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ReviewComment",
  },
  // Task integration
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
  },
  labels: [String],
  dueDate: Date,
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    text: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],
}, {
  timestamps: true,
});

// Indexes for efficient queries
issueSchema.index({ projectId: 1, status: 1, createdAt: -1 });
issueSchema.index({ assignee: 1, status: 1 });
issueSchema.index({ prId: 1 });
issueSchema.index({ taskId: 1 });

module.exports = mongoose.model("Issue", issueSchema);
