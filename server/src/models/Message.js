const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      required: true,
      maxlength: 4000,
    },
    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FileAsset",
      },
    ],
    reactions: {
      type: Map,
      of: String,
      default: {},
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
