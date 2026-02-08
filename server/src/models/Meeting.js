const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    default: 'Team Meeting'
  },
  type: {
    type: String,
    enum: ['project', 'task', 'code_review', 'standup'],
    default: 'project'
  },
  referenceId: {
    type: String, // ID of the task or PR if applicable
    default: null
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date
  }],
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: Date
}, {
  timestamps: true
});

// Index for finding active meetings in a project quickly
meetingSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('Meeting', meetingSchema);
