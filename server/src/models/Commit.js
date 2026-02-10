const mongoose = require('mongoose');

const commitSchema = new mongoose.Schema({
  repositoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  commitHash: {
      type: String,
      required: true,
      unique: true
  },
  branch: {
      type: String,
      default: 'main'
  },
  filesChanged: [{
      path: String,
      type: { type: String, enum: ['add', 'modify', 'delete'] },
      oldContent: String, 
      newContent: String
  }],
  parentCommit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Commit'
  },
  stats: {
      additions: { type: Number, default: 0 },
      deletions: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Commit', commitSchema);
