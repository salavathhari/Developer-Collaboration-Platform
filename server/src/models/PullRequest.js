const mongoose = require("mongoose");

const pullRequestSchema = new mongoose.Schema(
  {
    number: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
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
    status: {
      type: String,
      enum: ["open", "blocked", "approved", "merged", "closed"],
      default: "open",
      index: true,
    },
    baseBranch: {
      type: String,
      default: "main",
      required: true,
    },
    headBranch: {
      type: String,
      required: true,
    },
    commits: [
      {
        hash: String,
        message: String,
        author: String,
        email: String,
        date: Date,
      },
    ],
    filesChanged: [
      {
        path: String,
        filename: String,
        additions: Number,
        deletions: Number,
        status: String, // 'added', 'modified', 'deleted'
      },
    ],
    reviewers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    approvals: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        approvedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Merge information
    mergeCommitHash: {
      type: String,
      default: null,
    },
    mergedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    mergedAt: {
      type: Date,
      default: null,
    },
    // Conflicts information (if merge attempted and failed)
    conflicts: [String],
  },
  { timestamps: true }
);

// Compound index for projectId and number (unique PR number per project)
pullRequestSchema.index({ projectId: 1, number: 1 }, { unique: true });

// Index for queries
pullRequestSchema.index({ projectId: 1, status: 1 });
pullRequestSchema.index({ author: 1 });
pullRequestSchema.index({ reviewers: 1 });

module.exports = mongoose.model("PullRequest", pullRequestSchema);
