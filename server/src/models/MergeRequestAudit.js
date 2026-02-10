const mongoose = require("mongoose");

const mergeRequestAuditSchema = new mongoose.Schema(
  {
    prId: {
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
    mergedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mergeCommitHash: {
      type: String,
      required: true,
    },
    baseBranch: {
      type: String,
      required: true,
    },
    headBranch: {
      type: String,
      required: true,
    },
    mergeDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    mergeOutputLog: {
      type: String,
      default: "",
    },
    // Snapshot of PR data at merge time
    prSnapshot: {
      title: String,
      description: String,
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approvals: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          approvedAt: Date,
        },
      ],
      filesChanged: [
        {
          path: String,
          filename: String,
          additions: Number,
          deletions: Number,
          status: String,
        },
      ],
      commits: [
        {
          hash: String,
          message: String,
          author: String,
          email: String,
          date: Date,
        },
      ],
    },
  },
  { timestamps: true }
);

// Indexes for audit queries
mergeRequestAuditSchema.index({ projectId: 1, mergeDate: -1 });
mergeRequestAuditSchema.index({ mergedBy: 1, mergeDate: -1 });

module.exports = mongoose.model("MergeRequestAudit", mergeRequestAuditSchema);
