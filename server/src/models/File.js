const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  repoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repository',
    required: true
  },
  branch: {
    type: String,
    required: true,
    default: 'main'
  },
  filePath: {
    type: String, // e.g., 'src/components/Button.js'
    required: true
  },
  fileName: {
    type: String, // e.g., 'Button.js'
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  isDirectory: {
    type: Boolean,
    default: false
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Index for efficient lookups by path and branch
fileSchema.index({ repoId: 1, branch: 1, filePath: 1 }, { unique: true });

module.exports = mongoose.model('File', fileSchema);
