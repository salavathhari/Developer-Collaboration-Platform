const mongoose = require("mongoose");

const repositorySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
    required: true,
    unique: true // One main repo per project for simplicty in MVP, or allow multiple
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: String,
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  defaultBranch: {
    type: String,
    default: "main"
  },
  branches: [{
    name: { type: String, required: true },
    headCommit: { type: mongoose.Schema.Types.ObjectId, ref: "Commit" }
  }],
}, { timestamps: true });

module.exports = mongoose.model("Repository", repositorySchema);