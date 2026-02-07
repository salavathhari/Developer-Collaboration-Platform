const mongoose = require("mongoose");

const aiLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    prompt: {
      type: String,
      required: true,
      maxlength: 8000,
    },
    response: {
      type: String,
      required: true,
      maxlength: 12000,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AiLog", aiLogSchema);
