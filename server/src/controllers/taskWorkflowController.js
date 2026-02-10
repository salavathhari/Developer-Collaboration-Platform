const Task = require("../models/Task");
const PullRequest = require("../models/PullRequest");
const Notification = require("../models/Notification");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * Link a task to a Pull Request
 * PUT /api/tasks/:taskId/link-pr
 */
const linkTaskToPR = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { prId } = req.body;

  if (!prId) {
    throw new ApiError(400, "prId is required");
  }

  // Verify task exists
  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Verify PR exists and belongs to same project
  const pr = await PullRequest.findById(prId);
  if (!pr) {
    throw new ApiError(404, "Pull Request not found");
  }

  if (pr.projectId.toString() !== task.projectId.toString()) {
    throw new ApiError(400, "PR and Task must belong to the same project");
  }

  // Link the PR
  task.linkedPRId = prId;
  await task.save();

  await task.populate("linkedPRId", "number title status");
  await task.populate("assignedTo assignees createdBy");

  return res.status(200).json({
    success: true,
    task,
    message: "Task linked to PR successfully"
  });
});

/**
 * Unlink a task from its PR
 * DELETE /api/tasks/:taskId/link-pr
 */
const unlinkTaskFromPR = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  task.linkedPRId = null;
  await task.save();

  await task.populate("assignedTo assignees createdBy");

  return res.status(200).json({
    success: true,
    task,
    message: "Task unlinked from PR successfully"
  });
});

/**
 * Link a task to an Issue
 * PUT /api/tasks/:taskId/link-issue
 */
const linkTaskToIssue = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { issueId } = req.body;

  if (!issueId) {
    throw new ApiError(400, "issueId is required");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  task.linkedIssueId = issueId;
  await task.save();

  await task.populate("linkedIssueId", "title status");
  await task.populate("assignedTo assignees createdBy");

  return res.status(200).json({
    success: true,
    task,
    message: "Task linked to issue successfully"
  });
});

/**
 * Get all tasks linked to a specific PR
 * GET /api/pr/:prId/tasks
 */
const getTasksForPR = asyncHandler(async (req, res) => {
  const { prId } = req.params;

  const tasks = await Task.find({ linkedPRId: prId })
    .sort({ createdAt: -1 })
    .populate("assignedTo assignees createdBy", "username email avatar");

  return res.status(200).json({
    success: true,
    tasks,
    count: tasks.length
  });
});

/**
 * Update task order for Kanban drag-and-drop
 * PUT /api/tasks/:taskId/reorder
 */
const reorderTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { columnId, order, destinationColumnTasks } = req.body;

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Update the moved task
  task.columnId = columnId;
  task.order = order;
  
  // Map columnId to status
  const columnStatusMap = {
    'todo': 'todo',
    'in-progress': 'in_progress',
    'review': 'review',
    'blocked': 'blocked',
    'done': 'done'
  };
  
  if (columnId && columnStatusMap[columnId]) {
    task.status = columnStatusMap[columnId];
  }

  await task.save();

  // Update order of other tasks in destination column
  if (destinationColumnTasks && Array.isArray(destinationColumnTasks)) {
    const bulkOps = destinationColumnTasks.map((taskUpdate, index) => ({
      updateOne: {
        filter: { _id: taskUpdate.taskId },
        update: { $set: { order: index } }
      }
    }));
    
    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }
  }

  await task.populate("assignedTo assignees createdBy linkedPRId linkedIssueId");

  return res.status(200).json({
    success: true,
    task,
    message: "Task reordered successfully"
  });
});

module.exports = {
  linkTaskToPR,
  unlinkTaskFromPR,
  linkTaskToIssue,
  getTasksForPR,
  reorderTask
};
