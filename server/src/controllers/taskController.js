const Task = require("../models/Task");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sanitizeString } = require("../utils/sanitize");
const { logActivity } = require("../utils/activity");
const { createNotification, emitNotification } = require("../utils/notify");

const getTasks = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const cursor = req.query.cursor ? new Date(req.query.cursor) : null;

  const query = { projectId };
  if (cursor) {
    query.createdAt = { $lt: cursor };
  }

  const tasks = await Task.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("assignees", "name email avatar")
    .populate("createdBy", "name email avatar");

  const nextCursor = tasks.length
    ? tasks[tasks.length - 1].createdAt
    : null;

  return res.status(200).json({ tasks, nextCursor });
});

const createTask = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const title = sanitizeString(req.body.title || "");
  const description = sanitizeString(req.body.description || "");
  const status = req.body.status || "todo";

  if (!title) {
    throw new ApiError(400, "Task title is required");
  }

  const task = await Task.create({
    projectId,
    title,
    description,
    status,
    assignees: req.body.assignees || [],
    labels: req.body.labels || [],
    dueDate: req.body.dueDate || null,
    priority: req.body.priority || "medium",
    createdBy: req.user.id,
  });

  const io = req.app.get("io");
  if (io) {
    io.to(projectId).emit("task_created", { task });
  }

  await logActivity({
    projectId,
    actorId: req.user.id,
    type: "taskCreated",
    payload: { taskId: task.id, title: task.title },
  });

  return res.status(201).json({ task });
});

const updateTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const updates = {};
  const statusChanged = req.body.status !== undefined;

  if (req.body.title) {
    updates.title = sanitizeString(req.body.title);
  }

  if (req.body.description !== undefined) {
    updates.description = sanitizeString(req.body.description || "");
  }

  if (req.body.status) {
    updates.status = req.body.status;
  }

  if (req.body.labels) {
    updates.labels = req.body.labels;
  }

  if (req.body.dueDate !== undefined) {
    updates.dueDate = req.body.dueDate;
  }

  if (req.body.priority) {
    updates.priority = req.body.priority;
  }

  const task = await Task.findOneAndUpdate(
    { _id: taskId, projectId },
    updates,
    { new: true }
  )
    .populate("assignees", "name email avatar")
    .populate("createdBy", "name email avatar");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const io = req.app.get("io");
  if (io) {
    io.to(projectId).emit("task_updated", { task });
    if (statusChanged) {
      io.to(projectId).emit("task_moved", { task });
    }
  }

  await logActivity({
    projectId,
    actorId: req.user.id,
    type: "taskUpdated",
    payload: { taskId: task.id },
  });

  return res.status(200).json({ task });
});

const deleteTask = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const task = await Task.findOneAndDelete({ _id: taskId, projectId });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const io = req.app.get("io");
  if (io) {
    io.to(projectId).emit("task_deleted", { taskId });
  }

  await logActivity({
    projectId,
    actorId: req.user.id,
    type: "taskDeleted",
    payload: { taskId: taskId },
  });

  return res.status(200).json({ success: true });
});

const assignUser = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { userId } = req.body;

  const task = await Task.findOne({ _id: taskId, projectId });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (!task.assignees.map((id) => id.toString()).includes(userId)) {
    task.assignees.push(userId);
    await task.save();

    const io = req.app.get("io");
    const notification = await createNotification({
      userId,
      type: "task_assigned",
      projectId,
      payload: { taskId: task.id, title: task.title },
    });
    emitNotification(io, notification);
  }

  return res.status(200).json({ task });
});

const unassignUser = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const { userId } = req.body;

  const task = await Task.findOne({ _id: taskId, projectId });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  task.assignees = task.assignees.filter(
    (assignee) => assignee.toString() !== userId
  );
  await task.save();

  return res.status(200).json({ task });
});

const addComment = asyncHandler(async (req, res) => {
  const { projectId, taskId } = req.params;
  const content = sanitizeString(req.body.content || "");

  if (!content) {
    throw new ApiError(400, "Comment is required");
  }

  const task = await Task.findOne({ _id: taskId, projectId });
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  task.comments.push({ authorId: req.user.id, content });
  await task.save();

  const io = req.app.get("io");
  if (io) {
    io.to(projectId).emit("task_commented", { taskId: task.id });
  }

  return res.status(201).json({ task });
});

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  assignUser,
  unassignUser,
  addComment,
};
