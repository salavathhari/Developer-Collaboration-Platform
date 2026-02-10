const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  roomType: {
    type: String,
    enum: ["project", "pr", "file"],
    required: true,
    index: true,
  },
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChatMessage",
  },
  edited: {
    type: Boolean,
    default: false,
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    readAt: {
      type: Date,
      default: Date.now,
    },
  }],
  attachments: [{
    filename: String,
    url: String,
    mimeType: String,
  }],
  deleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
chatMessageSchema.index({ projectId: 1, roomType: 1, roomId: 1, createdAt: -1 });
chatMessageSchema.index({ projectId: 1, createdAt: -1 });
chatMessageSchema.index({ "mentions": 1, createdAt: -1 });

// Virtual for room identifier
chatMessageSchema.virtual('fullRoomId').get(function() {
  return `${this.roomType}:${this.roomId}`;
});

chatMessageSchema.set('toJSON', { virtuals: true });
chatMessageSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
