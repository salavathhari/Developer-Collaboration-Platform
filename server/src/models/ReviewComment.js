const mongoose = require("mongoose");

const reviewCommentSchema = new mongoose.Schema(
  {
    pullRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PullRequest",
      required: true,
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
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReviewComment", reviewCommentSchema);
