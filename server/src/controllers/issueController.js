const Issue = require("../models/Issue");
const Project = require("../models/Project");
const PullRequest = require("../models/PullRequest");
const { sanitizeString } = require("../utils/sanitize");
const { createNotification } = require("../utils/notify");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

/**
 * Create issue from any context (PR, chat, comment, etc)
 * POST /api/issues
 */
exports.createIssue = asyncHandler(async (req, res) => {
  const {
    projectId,
    title,
    description,
    priority,
    // Context linking
    prId,
    filePath,
    lineNumber,
    chatMessageId,
    reviewCommentId,
    taskId,
  } = req.body;

  if (!projectId || !title) {
    throw new ApiError(400, "Project ID and title are required");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Verify membership
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  const issue = await Issue.create({
    project: projectId,
    author: req.user.id,
    title: sanitizeString(title),
    description: description ? sanitizeString(description) : "",
    priority: priority || "medium",
    status: "open",
    prId: prId || null,
    filePath: filePath || null,
    lineNumber: lineNumber || null,
    chatMessageId: chatMessageId || null,
    reviewCommentId: reviewCommentId || null,
    taskId: taskId || null,
  });

  await issue.populate("author", "name email avatar");

  // Notify project owner if not the creator
  if (project.owner.toString() !== req.user.id) {
    await createNotification({
      userId: project.owner,
      type: "issue_created",
      message: `${req.user.name} created issue: ${title}`,
      projectId,
      referenceId: issue._id,
      payload: { link: `/projects/${projectId}/issues/${issue._id}` },
    });
  }

  res.status(201).json(issue);
});

/**
 * Get all issues for a project
 * GET /api/issues/project/:projectId
 */
exports.getIssues = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { status, priority } = req.query;

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Verify membership
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  const query = { project: projectId };
  if (status) {
    query.status = status;
  }
  if (priority) {
    query.priority = priority;
  }

  const issues = await Issue.find(query)
    .sort({ createdAt: -1 })
    .populate("author", "name email avatar")
    .populate("assignedTo", "name email avatar");

  res.json(issues);
});

/**
 * Get single issue
 * GET /api/issues/:id
 */
exports.getIssue = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const issue = await Issue.findById(id)
    .populate("author assignedTo", "name email avatar")
    .populate("prId")
    .populate("taskId");

  if (!issue) {
    throw new ApiError(404, "Issue not found");
  }

  const project = await Project.findById(issue.project);
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  res.json(issue);
});

/**
 * Update issue status
 * PUT /api/issues/:id/status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["open", "in_progress", "done", "closed"].includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  const issue = await Issue.findById(id);
  if (!issue) {
    throw new ApiError(404, "Issue not found");
  }

  const project = await Project.findById(issue.project);
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  issue.status = status;
  await issue.save();

  await issue.populate("author assignedTo", "name email avatar");

  // Notify assignee and author
  const notifyUsers = [issue.author.toString()];
  if (issue.assignedTo) {
    notifyUsers.push(issue.assignedTo.toString());
  }

  for (const userId of [...new Set(notifyUsers)]) {
    if (userId !== req.user.id) {
      await createNotification({
        userId,
        type: "issue_updated",
        message: `Issue status updated to ${status}`,
        projectId: project._id,
        referenceId: issue._id,
        payload: { link: `/projects/${project._id}/issues/${issue._id}` },
      });
    }
  }

  res.json(issue);
});

/**
 * Assign issue to user
 * PUT /api/issues/:id/assign
 */
exports.assignIssue = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  const issue = await Issue.findById(id);
  if (!issue) {
    throw new ApiError(404, "Issue not found");
  }

  const project = await Project.findById(issue.project);
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  // Verify assignee is project member
  const assigneeIsMember = project.members.some(m => m.user.toString() === userId) ||
                            project.owner.toString() === userId;

  if (!assigneeIsMember) {
    throw new ApiError(400, "Assignee must be a project member");
  }

  issue.assignedTo = userId;
  await issue.save();

  await issue.populate("author assignedTo", "name email avatar");

  // Notify assignee
  if (userId !== req.user.id) {
    await createNotification({
      userId,
      type: "issue_assigned",
      message: `${req.user.name} assigned you to: ${issue.title}`,
      projectId: project._id,
      referenceId: issue._id,
      payload: { link: `/projects/${project._id}/issues/${issue._id}` },
    });
  }

  res.json(issue);
});

/**
 * Add comment to issue
 * POST /api/issues/:id/comment
 */
exports.addComment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  if (!comment) {
    throw new ApiError(400, "Comment is required");
  }

  const issue = await Issue.findById(id);
  if (!issue) {
    throw new ApiError(404, "Issue not found");
  }

  const project = await Project.findById(issue.project);
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  issue.comments.push({
    author: req.user.id,
    comment: sanitizeString(comment),
  });

  await issue.save();
  await issue.populate("comments.author", "name email avatar");
  await issue.populate("author assignedTo", "name email avatar");

  // Notify author and assignee
  const notifyUsers = [issue.author.toString()];
  if (issue.assignedTo) {
    notifyUsers.push(issue.assignedTo.toString());
  }

  for (const userId of [...new Set(notifyUsers)]) {
    if (userId !== req.user.id) {
      await createNotification({
        userId,
        type: "issue_comment",
        message: `${req.user.name} commented on: ${issue.title}`,
        projectId: project._id,
        referenceId: issue._id,
        payload: { link: `/projects/${project._id}/issues/${issue._id}` },
      });
    }
  }

  res.json(issue);
});

module.exports = exports;
