const mongoose = require("mongoose");

const presenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    index: true,
  },
  roomType: {
    type: String,
    enum: ["project", "pr", "file", "live_review"],
  },
  roomId: String,
  socketId: String,
  status: {
    type: String,
    enum: ["online", "away", "busy"],
    default: "online",
  },
  currentFile: String,
  currentLine: Number,
  lastActivity: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  // Automatically remove after 5 minutes of inactivity
  expireAfterSeconds: 300,
});

// Compound indexes
presenceSchema.index({ projectId: 1, userId: 1 }, { unique: true });
presenceSchema.index({ projectId: 1, roomType: 1, roomId: 1 });
presenceSchema.index({ lastActivity: 1 });

// Update lastActivity on any change
presenceSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

module.exports = mongoose.model("Presence", presenceSchema);
