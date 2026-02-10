const mongoose = require("mongoose");

const taskRefSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    title: {
      type: String,
      trim: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "review", "done"],
      default: "todo",
    },
    daysOverdue: {
      type: Number,
      default: 0,
    },
    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { _id: false }
);

const insightSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    windowEnd: {
      type: Date,
      required: true,
    },
    analytics: {
      taskCounts: {
        total: { type: Number, default: 0 },
        byStatus: { type: Object, default: {} },
        byPriority: { type: Object, default: {} },
        completedLast7d: { type: Number, default: 0 },
      },
      overdueTasks: [taskRefSchema],
      dueSoonTasks: [taskRefSchema],
      activityCounts: {
        total: { type: Number, default: 0 },
        byType: { type: Object, default: {} },
      },
      workloadByAssignee: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
          },
          name: { type: String, trim: true },
          openTasks: { type: Number, default: 0 },
          overdueTasks: { type: Number, default: 0 },
        },
      ],
      codeStats: {
          mergedPrCount: { type: Number, default: 0 },
          openPrCount: { type: Number, default: 0 },
          avgMergeTimeHours: { type: Number, default: 0 },
          commitCount: { type: Number, default: 0 },
          commitsByAuthor: { type: Object, default: {} }
      },
    },
    ai: {
      priorityRecommendations: [
        {
          taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
          },
          title: { type: String, trim: true },
          recommendedPriority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium",
          },
          reason: { type: String, trim: true },
        },
      ],
      productivityInsights: [{ type: String, trim: true }],
      dashboardSuggestions: [{ type: String, trim: true }],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProjectInsight", insightSchema);
