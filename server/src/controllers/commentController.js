const ReviewComment = require("../models/ReviewComment");
const PullRequest = require("../models/PullRequest");
const Project = require("../models/Project");
const { sanitizeString } = require("../utils/sanitize");
const { createNotification } = require("../utils/notify");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

/**
 * Create inline comment on PR
 * POST /api/pr/:prId/comment
 */
exports.createComment = asyncHandler(async (req, res) => {
  const { prId } = req.params;
  const { filePath, lineNumber, content, parentCommentId } = req.body;

  if (!filePath || lineNumber === undefined || !content) {
    throw new ApiError(400, "Missing required fields");
  }

  const pr = await PullRequest.findById(prId).populate("project");
  if (!pr) {
    throw new ApiError(404, "Pull request not found");
  }

  // Verify user can comment (member or reviewer)
  const project = pr.project;
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;
  const isReviewer = pr.reviewers && pr.reviewers.some(r => r.toString() === req.user.id);

  if (!isMember && !isReviewer) {
    throw new ApiError(403, "Not authorized to comment on this PR");
  }

  // Detect mentions
  const mentions = extractMentions(sanitizeString(content));

  const comment = await ReviewComment.create({
    pullRequestId: prId,
    projectId: project._id,
    author: req.user.id,
    filePath,
    lineNumber,
    content: sanitizeString(content),
    parentCommentId: parentCommentId || null,
    mentions,
  });

  await comment.populate("author", "name email avatar");

  // Notify PR author and reviewers
  const notifyUsers = [pr.author];
  if (pr.reviewers) {
    notifyUsers.push(...pr.reviewers);
  }
  
  for (const userId of notifyUsers) {
    if (userId.toString() !== req.user.id) {
      await createNotification({
        userId,
        type: "pr_comment",
        message: `${req.user.name} commented on PR #${pr.number}`,
        projectId: project._id,
        referenceId: comment._id,
        payload: { link: `/projects/${project._id}/pr/${prId}` },
      });
    }
  }

  // Notify mentioned users
  for (const mentionedId of mentions) {
    if (mentionedId.toString() !== req.user.id && !notifyUsers.some(u => u.toString() === mentionedId.toString())) {
      await createNotification({
        userId: mentionedId,
        type: "mention",
        message: `${req.user.name} mentioned you in PR comment`,
        projectId: project._id,
        referenceId: comment._id,
        payload: { link: `/projects/${project._id}/pr/${prId}#comment-${comment._id}` },
      });
    }
  }

  res.status(201).json(comment);
});

/**
 * Get all comments for a PR
 * GET /api/pr/:prId/comments
 */
exports.getComments = asyncHandler(async (req, res) => {
  const { prId } = req.params;
  const { resolved } = req.query;

  const pr = await PullRequest.findById(prId).populate("project");
  if (!pr) {
    throw new ApiError(404, "Pull request not found");
  }

  // Verify access
  const project = pr.project;
  const isMember = project.members.some(m => m.user.toString() === req.user.id) ||
                   project.owner.toString() === req.user.id;

  if (!isMember) {
    throw new ApiError(403, "Not authorized");
  }

  const query = { pullRequestId: prId };
  if (resolved !== undefined) {
    query.resolved = resolved === 'true';
  }

  const comments = await ReviewComment.find(query)
    .sort({ createdAt: 1 })
    .populate("author", "name email avatar")
    .populate("resolvedBy", "name email");

  // Group by thread
  const threads = {};
  comments.forEach(comment => {
    const tid = comment.threadId || comment._id.toString();
    if (!threads[tid]) {
      threads[tid] = [];
    }
    threads[tid].push(comment);
  });

  res.json({ comments, threads });
});

/**
 * Resolve/unresolve a comment thread
 * PUT /api/pr/:prId/comment/:commentId/resolve
 */
exports.resolveComment = asyncHandler(async (req, res) => {
  const { prId, commentId } = req.params;
  const { resolved } = req.body;

  const comment = await ReviewComment.findById(commentId);
  if (!comment || comment.pullRequestId.toString() !== prId) {
    throw new ApiError(404, "Comment not found");
  }

  const pr = await PullRequest.findById(prId).populate("project");
  const project = pr.project;

  // Only PR author, reviewers, or project owner can resolve
  const canResolve = pr.author.toString() === req.user.id ||
                     (pr.reviewers && pr.reviewers.some(r => r.toString() === req.user.id)) ||
                     project.owner.toString() === req.user.id;

  if (!canResolve) {
    throw new ApiError(403, "Not authorized to resolve comments");
  }

  comment.resolved = resolved;
  if (resolved) {
    comment.resolvedBy = req.user.id;
    comment.resolvedAt = new Date();
  } else {
    comment.resolvedBy = null;
    comment.resolvedAt = null;
  }

  await comment.save();
  await comment.populate("author resolvedBy", "name email avatar");

  res.json(comment);
});

/**
 * Edit a comment
 * PUT /api/pr/:prId/comment/:commentId
 */
exports.editComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const comment = await ReviewComment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  if (comment.author.toString() !== req.user.id) {
    throw new ApiError(403, "Not authorized to edit this comment");
  }

  comment.content = sanitizeString(content);
  comment.edited = true;
  comment.editedAt = new Date();
  await comment.save();

  await comment.populate("author", "name email avatar");

  res.json(comment);
});

/**
 * Delete a comment
 * DELETE /api/pr/:prId/comment/:commentId
 */
exports.deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await ReviewComment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const pr = await PullRequest.findById(comment.pullRequestId).populate("project");
  const project = pr.project;

  // Only author or project owner can delete
  const canDelete = comment.author.toString() === req.user.id ||
                    project.owner.toString() === req.user.id;

  if (!canDelete) {
    throw new ApiError(403, "Not authorized to delete this comment");
  }

  await comment.deleteOne();

  res.json({ success: true });
});

// Helper to extract mentions
function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  return Array.from(matches, m => m[1]);
}

module.exports = exports;
