const mongoose = require("mongoose");

const reviewCommentSchema = new mongoose.Schema(
  {
    pullRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PullRequest",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    lineNumber: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: Date,
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReviewComment",
    },
    threadId: {
      type: String,
      index: true,
    },
    mentions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    reactions: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      emoji: String,
    }],
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
reviewCommentSchema.index({ pullRequestId: 1, filePath: 1, lineNumber: 1 });
reviewCommentSchema.index({ pullRequestId: 1, resolved: 1, createdAt: -1 });
reviewCommentSchema.index({ threadId: 1, createdAt: 1 });

// Generate threadId for parent comments
reviewCommentSchema.pre('save', function(next) {
  if (!this.threadId && !this.parentCommentId) {
    this.threadId = this._id.toString();
  }
  next();
});

// Populate thread on replies
reviewCommentSchema.pre('save', async function(next) {
  if (this.parentCommentId && !this.threadId) {
    const parent = await this.constructor.findById(this.parentCommentId);
    if (parent) {
      this.threadId = parent.threadId || parent._id.toString();
    }
  }
  next();
});

module.exports = mongoose.model("ReviewComment", reviewCommentSchema);
