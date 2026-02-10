const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const PullRequest = require("../models/PullRequest");
const File = require("../models/File");
const Notification = require("../models/Notification");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { logActivity } = require("../utils/activity");
const { createNotification } = require("../utils/notify");
const taskService = require("../services/taskService");

// Multer setup for attachments
const uploadDir = path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads", "tasks");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `task_${Date.now()}_${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single("file");

const uploadAttachment = (req, res, next) => {
  upload(req, res, function (err) {
    if (err) {
      return next(new ApiError(400, "File upload error: " + err.message));
    }
    next();
  });
};

/**
 * GET /api/tasks/:projectId
 * Fetch tasks with advanced filtering, search, and pagination
 */
const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const {
    status,
    priority,
    assignee,
    label,
    search,
    sort = "-updatedAt",
    limit = 50,
    offset = 0,
  } = req.query;

  const query = { projectId };

  // Filters
  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }
  if (priority) {
    query.priority = Array.isArray(priority) ? { $in: priority } : priority;
  }
  if (assignee) {
    query.assignees = assignee;
  }
  if (label) {
    query.labels = Array.isArray(label) ? { $in: label } : label;
  }

  // Search
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { labels: { $regex: search, $options: "i" } },
    ];
  }

  const tasks = await Task.find(query)
    .sort(sort)
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .populate("assignedTo", "username email avatar")
    .populate("assignees", "username email avatar")
    .populate("createdBy", "username email avatar")
    .populate("linkedPRId", "number title status")
    .populate("linkedIssueId", "title status")
    .populate("linkedFiles", "name size path")
    .lean();

  const total = await Task.countDocuments(query);

  return res.status(200).json({
    success: true,
    tasks,
    total,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
});

/**
 * GET /api/tasks/single/:taskId
 * Get a single task by ID
 */
const getTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId)
    .populate("assignedTo", "username email avatar")
    .populate("assignees", "username email avatar")
    .populate("createdBy", "username email avatar")
    .populate("comments.userId", "username email avatar")
    .populate("linkedPRId", "number title status")
    .populate("linkedIssueId", "title status")
    .populate("linkedFiles", "name size path uploadedBy")
    .populate("attachments.uploadedBy", "username email avatar");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return res.status(200).json({ success: true, task });
});

/**
 * GET /api/tasks/:projectId/analytics
 * Analytics for tasks in a project
 */
const getTaskAnalytics = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const total = await Task.countDocuments({ projectId });

  const byStatus = await Task.aggregate([
    { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const byPriority = await Task.aggregate([
    { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
    { $group: { _id: "$priority", count: { $sum: 1 } } },
  ]);

  const completed = await Task.countDocuments({ projectId, status: "done" });
  const rate = total > 0 ? (completed / total) * 100 : 0;

  const byUser = await Task.aggregate([
    {
      $match: {
        projectId: new mongoose.Types.ObjectId(projectId),
        status: "done",
      },
    },
    { $group: { _id: "$createdBy", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        name: "$user.username",
        count: 1,
        avatar: "$user.avatar",
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({
    success: true,
    total,
    completed,
    completionRate: rate.toFixed(1),
    byStatus: byStatus.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {}
    ),
    byPriority: byPriority.reduce(
      (acc, curr) => ({ ...acc, [curr._id]: curr.count }),
      {}
    ),
    userProductivity: byUser,
  });
});

/**
 * POST /api/tasks/:projectId
 * Create a new task using taskService
 */
const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const payload = { ...req.body, projectId };

  const task = await taskService.createTask(req.user, projectId, payload);

  // Emit socket event (handled in socket layer or here)
  if (req.app.io) {
    req.app.io.to(`project:${projectId}`).emit("task:created", { task });
  }

  return res.status(201).json({ success: true, task });
});

/**
 * PUT /api/tasks/:taskId
 * Update a task using taskService
 */
const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const updates = req.body;

  const options = {
    requirePRForReview: req.body.requirePRForReview,
    requireMergedPRForDone: req.body.requireMergedPRForDone,
  };

  const { task, changedFields } = await taskService.updateTask(
    req.user,
    taskId,
    updates,
    options
  );

  // Emit socket event
  if (req.app.io) {
    req.app.io
      .to(`project:${task.projectId}`)
      .emit("task:updated", { task, changedFields });
  }

  return res.status(200).json({ success: true, task, changedFields });
});

/**
 * DELETE /api/tasks/:taskId
 * Delete a task
 */
const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findById(taskId);

  if (!task) throw new ApiError(404, "Task not found");

  const projectId = task.projectId;
  await task.deleteOne();

  // Emit socket event
  if (req.app.io) {
    req.app.io.to(`project:${projectId}`).emit("task:deleted", { taskId });
  }

  logActivity(projectId, req.user.id, "deleted_task", `Deleted task: ${task.title}`);

  return res.status(200).json({ success: true, message: "Task deleted" });
});

/**
 * POST /api/tasks/:taskId/link-pr
 * Link a pull request to a task
 */
const linkPR = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { prId } = req.body;

  if (!prId) {
    throw new ApiError(400, "prId is required");
  }

  const task = await taskService.linkPR(req.user, taskId, prId);

  // Emit socket event
  if (req.app.io) {
    req.app.io.to(`project:${task.projectId}`).emit("task:updated", {
      task,
      changedFields: ["linkedPRId"],
    });
  }

  return res.status(200).json({ success: true, task });
});

/**
 * POST /api/tasks/:taskId/link-file
 * Link/attach a file to a task
 */
const linkFile = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { fileId } = req.body;

  if (!fileId) {
    throw new ApiError(400, "fileId is required");
  }

  const task = await taskService.linkFile(req.user, taskId, fileId);

  // Emit socket event
  if (req.app.io) {
    req.app.io.to(`project:${task.projectId}`).emit("task:updated", {
      task,
      changedFields: ["linkedFiles"],
    });
  }

  return res.status(200).json({ success: true, task });
});

/**
 * POST /api/tasks/:taskId/comment
 * Add a comment to a task
 */
const addComment = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { text } = req.body;

  if (!text) throw new ApiError(400, "Comment text required");

  const task = await taskService.addComment(req.user, taskId, text);

  // Emit socket event
  if (req.app.io) {
    const latestComment = task.comments[task.comments.length - 1];
    req.app.io.to(`project:${task.projectId}`).emit("task:comment", {
      taskId: task._id,
      comment: latestComment,
    });
  }

  return res.status(200).json({ success: true, task });
});

/**
 * POST /api/tasks/:taskId/move
 * Move task across columns with drag-and-drop reordering
 */
const moveTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { toStatus, toOrderKey } = req.body;

  if (!toStatus) {
    throw new ApiError(400, "toStatus is required");
  }

  const options = {
    requirePRForReview: req.body.requirePRForReview,
    requireMergedPRForDone: req.body.requireMergedPRForDone,
  };

  const { task, fromStatus, toStatus: newStatus } = await taskService.moveTaskAcrossColumns(
    req.user,
    taskId,
    toStatus,
    toOrderKey,
    options
  );

  // Emit socket event
  if (req.app.io) {
    req.app.io.to(`project:${task.projectId}`).emit("task:moved", {
      taskId: task._id,
      task,
      fromStatus,
      toStatus: newStatus,
      orderKey: task.orderKey,
    });
  }

  return res.status(200).json({
    success: true,
    task,
    fromStatus,
    toStatus: newStatus,
  });
});

/**
 * POST /api/tasks/bulk-update
 * Bulk update multiple tasks
 */
const bulkUpdateTasks = asyncHandler(async (req, res) => {
  const { taskIds, changes, projectId } = req.body;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new ApiError(400, "taskIds array is required");
  }

  if (!changes || typeof changes !== "object") {
    throw new ApiError(400, "changes object is required");
  }

  const results = await taskService.bulkUpdateTasks(
    req.user,
    projectId,
    taskIds,
    changes
  );

  // Emit socket events for successful updates
  if (req.app.io && results.successful.length > 0) {
    req.app.io.to(`project:${projectId}`).emit("task:bulk_updated", {
      tasks: results.successful.map((r) => r.task),
    });
  }

  return res.status(200).json({
    success: true,
    results,
  });
});

/**
 * POST /api/tasks/:taskId/attachment
 * Upload and attach a file to task
 */
const addAttachment = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");
  const { taskId } = req.params;

  const task = await Task.findById(taskId);
  if (!task) throw new ApiError(404, "Task not found");

  const attachment = {
    name: req.file.originalname,
    size: req.file.size,
    url: `/uploads/tasks/${req.file.filename}`,
    uploadedBy: req.user.id,
    uploadedAt: new Date(),
  };

  task.attachments.push(attachment);
  task.addActivity(req.user.id, "file_linked", {
    fileName: req.file.originalname,
  });
  await task.save();

  await task.populate("attachments.uploadedBy", "username email avatar");

  // Emit socket event
  if (req.app.io) {
    req.app.io.to(`project:${task.projectId}`).emit("task:updated", {
      task,
      changedFields: ["attachments"],
    });
  }

  return res.status(200).json({ success: true, task, attachment });
});

module.exports = {
  getTasks,
  getTask,
  getTaskAnalytics,
  createTask,
  updateTask,
  deleteTask,
  linkPR,
  linkFile,
  addComment,
  moveTask,
  bulkUpdateTasks,
  addAttachment,
  uploadAttachment,
};
