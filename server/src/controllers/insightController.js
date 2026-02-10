const Activity = require("../models/Activity");
const ProjectInsight = require("../models/ProjectInsight");
const Task = require("../models/Task");
const PullRequest = require("../models/PullRequest");
const Commit = require("../models/Commit");
const Repository = require("../models/Repository");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { callAi } = require("../utils/aiClient");
const gitService = require("../services/gitService");

const DAY_MS = 24 * 60 * 60 * 1000;

const clampWindowDays = (value) => {
  if (Number.isNaN(value)) {
    return 30;
  }
  return Math.min(Math.max(value, 7), 90);
};

const buildCounts = (items, key) => {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
};

const safeParseJson = (text) => {
  if (!text) {
    return null;
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (error) {
    return null;
  }
};

const deriveHeuristicInsights = ({ overdueTasks, dueSoonTasks, completionRate }) => {
  const priorityRecommendations = [];

  overdueTasks.slice(0, 5).forEach((task) => {
    priorityRecommendations.push({
      taskId: task.taskId,
      title: task.title,
      recommendedPriority: "high",
      reason: "Overdue tasks should be resolved first to unblock work.",
    });
  });

  dueSoonTasks.slice(0, 3).forEach((task) => {
    priorityRecommendations.push({
      taskId: task.taskId,
      title: task.title,
      recommendedPriority: "medium",
      reason: "Due soon tasks need attention to avoid becoming overdue.",
    });
  });

  const productivityInsights = [];
  if (completionRate < 0.3) {
    productivityInsights.push(
      "Completion rate is below 30%. Consider tightening scope or splitting tasks."
    );
  } else if (completionRate > 0.7) {
    productivityInsights.push(
      "Completion rate is strong. Maintain momentum with clear next steps."
    );
  } else {
    productivityInsights.push(
      "Steady completion pace. Review blockers and keep tasks flowing."
    );
  }

  const dashboardSuggestions = [
    "Stacked bar chart for tasks by status and priority.",
    "Line chart for tasks completed per week.",
    "Table highlighting overdue tasks and owners.",
  ];

  return { priorityRecommendations, productivityInsights, dashboardSuggestions };
};

const generateInsights = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const provider = req.body.provider || process.env.AI_PROVIDER || "openai";
  const windowDays = clampWindowDays(Number(req.body.windowDays || 30));

  if (!projectId) {
    throw new ApiError(400, "Project is required");
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);

  const tasks = await Task.find({ projectId })
    .populate("assignedTo", "name")
    .sort({ updatedAt: -1 });

  // --- CODE STATS ---
  const prs = await PullRequest.find({
      projectId,
      createdAt: { $gte: windowStart } 
  }).lean();

  // Get commits and branches directly from git repository
  let commits = [];
  let activeBranches = 0;
  try {
      if (gitService.repoExists(projectId)) {
          const branches = await gitService.getBranches(projectId);
          activeBranches = branches.length;
          const commitSet = new Set(); // Prevent duplicate commits across branches
          
          // Get commits from all branches
          for (const branch of branches) {
              try {
                  const branchCommits = await gitService.getCommitHistory(projectId, branch, 100);
                  // Filter by windowStart and add to set
                  branchCommits.forEach(commit => {
                      if (commit.timestamp >= windowStart.getTime()) {
                          commitSet.add(JSON.stringify({
                              hash: commit.hash,
                              author: commit.author,
                              timestamp: commit.timestamp,
                              message: commit.message
                          }));
                      }
                  });
              } catch (err) {
                  // Skip if branch doesn't exist or has no commits
              }
          }
          
          // Convert back to array of objects
          commits = Array.from(commitSet).map(s => JSON.parse(s));
      }
  } catch (error) {
      console.error('Error getting git data:', error);
      commits = [];
      activeBranches = 0;
  }

  const mergedPrs = prs.filter(p => p.status === 'merged');
  const openPrs = prs.filter(p => p.status === 'open');
  let totalMergeTime = 0;
  mergedPrs.forEach(pr => {
      const start = new Date(pr.createdAt);
      const end = new Date(pr.updatedAt);
      totalMergeTime += (end - start);
  });
  const avgMergeTimeHours = mergedPrs.length > 0 ? (totalMergeTime / mergedPrs.length / (1000 * 60 * 60)).toFixed(1) : 0;
  
  // Count commits by author
  const commitsByAuthor = {};
  commits.forEach(commit => {
      const author = commit.author || 'unknown';
      commitsByAuthor[author] = (commitsByAuthor[author] || 0) + 1;
  });
  
  // Build top contributors from commit activity
  const topContributors = Object.entries(commitsByAuthor)
      .map(([name, commits]) => ({ name, commits }))
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10);
  // ------------------

  const activity = await Activity.find({
    projectId,
    createdAt: { $gte: windowStart },
  }).sort({ createdAt: -1 });

  const overdueTasks = [];
  const dueSoonTasks = [];
  const assigneeMap = new Map();

  const openTasks = tasks.filter((task) => task.status !== "done");
  const completedLast7d = tasks.filter(
    (task) => task.status === "done" && now - task.updatedAt <= 7 * DAY_MS
  ).length;

  tasks.forEach((task) => {
    if (!task.dueDate) {
      return;
    }

    const isOverdue = task.dueDate < now && task.status !== "done";
    const isDueSoon =
      task.dueDate >= now && task.dueDate <= new Date(now.getTime() + 3 * DAY_MS);

    const taskRef = {
      taskId: task._id,
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      daysOverdue: isOverdue
        ? Math.floor((now - task.dueDate) / DAY_MS)
        : 0,
      assignees: task.assignedTo ? [task.assignedTo._id] : [],
    };

    if (isOverdue) {
      overdueTasks.push(taskRef);
    }

    if (isDueSoon && task.status !== "done") {
      dueSoonTasks.push(taskRef);
    }
  });

  openTasks.forEach((task) => {
    if (task.assignedTo) {
      const assignee = task.assignedTo;
      const key = String(assignee._id);
      const entry = assigneeMap.get(key) || {
        userId: assignee._id,
        name: assignee.name,
        openTasks: 0,
        overdueTasks: 0,
      };
      entry.openTasks += 1;
      if (overdueTasks.some((item) => String(item.taskId) === String(task._id))) {
        entry.overdueTasks += 1;
      }
      assigneeMap.set(key, entry);
    }
  });

  const taskCounts = {
    total: tasks.length,
    byStatus: buildCounts(tasks, "status"),
    byPriority: buildCounts(tasks, "priority"),
    completedLast7d,
  };

  const activityCounts = {
    total: activity.length,
    byType: buildCounts(activity, "type"),
  };

  const completionRate = taskCounts.total
    ? Math.min(taskCounts.byStatus.done || 0, taskCounts.total) / taskCounts.total
    : 0;

  const promptPayload = {
    windowDays,
    taskCounts,
    overdueTasks: overdueTasks.slice(0, 10).map((task) => ({
      id: String(task.taskId),
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
      daysOverdue: task.daysOverdue,
    })),
    dueSoonTasks: dueSoonTasks.slice(0, 10).map((task) => ({
      id: String(task.taskId),
      title: task.title,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
    })),
    activityCounts,
    completionRate,
  };

  const prompt = `You are a product analytics assistant.\nProvide AI task recommendations based on the JSON payload.\nReturn valid JSON only with keys:\npriorityRecommendations (array of {taskId, title, recommendedPriority, reason}),\nproductivityInsights (array of strings),\ndashboardSuggestions (array of strings).\nKeep recommendations concise and actionable.\nPayload:\n${JSON.stringify(
    promptPayload
  )}`;

  let aiResult = null;
  try {
    const responseText = await callAi({ prompt, provider });
    aiResult = safeParseJson(responseText);
  } catch (error) {
    aiResult = null;
  }

  const fallback = deriveHeuristicInsights({
    overdueTasks,
    dueSoonTasks,
    completionRate,
  });

  const ai = {
    priorityRecommendations:
      aiResult?.priorityRecommendations || fallback.priorityRecommendations,
    productivityInsights:
      aiResult?.productivityInsights || fallback.productivityInsights,
    dashboardSuggestions:
      aiResult?.dashboardSuggestions || fallback.dashboardSuggestions,
  };

  const insight = await ProjectInsight.create({
    projectId,
    generatedBy: req.user.id,
    windowStart,
    windowEnd: now,
    analytics: {
      taskCounts,
      overdueTasks,
      dueSoonTasks,
      activityCounts,
      workloadByAssignee: Array.from(assigneeMap.values()),
      topContributors,
      codeStats: {
        commits: commits.length,
        activeBranches: activeBranches,
        mergedPRs: mergedPrs.length,
        avgMergeTimeHours: Number(avgMergeTimeHours)
      }
    },
    ai,
  });

  return res.status(200).json({ insight });
});

const getLatestInsight = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const insight = await ProjectInsight.findOne({ projectId }).sort({
    createdAt: -1,
  });

  if (!insight) {
    return res.status(200).json({ insight: null });
  }

  return res.status(200).json({ insight });
});

module.exports = {
  generateInsights,
  getLatestInsight,
};
