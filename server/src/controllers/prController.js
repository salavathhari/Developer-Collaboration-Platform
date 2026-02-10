const PullRequest = require("../models/PullRequest");
const ReviewComment = require("../models/ReviewComment");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Attachment = require("../models/Attachment");
const MergeRequestAudit = require("../models/MergeRequestAudit");
const Notification = require("../models/Notification");
const gitService = require("../services/gitService");
const { createNotification, emitNotification } = require("../utils/notify");

const ensureProjectMember = async (projectId, userId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project not found");
    error.statusCode = 404;
    throw error;
  }

  const isMember =
    project.owner.toString() === userId.toString() ||
    project.members.some((m) => m.user.toString() === userId.toString());

  if (!isMember) {
    const error = new Error("Only project members can access PRs");
    error.statusCode = 403;
    throw error;
  }

  return project;
};

const buildFileChangeEntries = async (projectId, baseBranch, headBranch, diffFiles) => {
  const entries = await Promise.all(
    diffFiles.map(async (file) => {
      let diffSnippet = "";
      try {
        const rawDiff = await gitService.getDiffForFile(
          projectId,
          baseBranch,
          headBranch,
          file.file || file.path
        );
        const lines = rawDiff.split("\n").slice(0, 40).join("\n");
        diffSnippet = lines.length > 0 ? lines : "";
      } catch (error) {
        diffSnippet = "";
      }

      return {
        path: file.file || file.path,
        filename: (file.file || file.path || "").split("/").pop(),
        additions: file.additions || 0,
        deletions: file.deletions || 0,
        status: file.status || "modified",
        diffSnippet,
      };
    })
  );

  return entries;
};

// Get all PRs for a project
exports.getPullRequests = async (req, res) => {
  try {
    const { projectId } = req.query;
    const { status } = req.query;

    if (!projectId) {
      return res.status(400).json({ message: "projectId is required" });
    }

    await ensureProjectMember(projectId, req.user.id);

    const query = { projectId };
    if (status) {
      query.status = status;
    }

    const prs = await PullRequest.find(query)
      .populate("author", "name email avatar")
      .populate("reviewers", "name email avatar")
      .populate("approvals.userId", "name email avatar")
      .populate("mergedBy", "name email avatar")
      .sort({ createdAt: -1 });
    
    res.json({ success: true, prs, count: prs.length });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Get single PR by ID
exports.getPullRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const pr = await PullRequest.findById(id)
      .populate("author", "name email avatar")
      .populate("reviewers", "name email avatar")
      .populate("approvals.userId", "name email avatar")
      .populate("mergedBy", "name email avatar")
      .populate("projectId", "name");
      
    if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId._id, req.user.id);
    
    // Refresh diff if still open/approved
    if (pr.status === "open" || pr.status === "approved") {
      try {
        const diffData = await gitService.getDiff(
          pr.projectId._id,
          pr.baseBranch,
          pr.headBranch
        );
        pr.filesChanged = await buildFileChangeEntries(
          pr.projectId._id,
          pr.baseBranch,
          pr.headBranch,
          diffData.files
        );
      } catch (error) {
        console.warn("Could not refresh diff:", error.message);
      }
    }

    const linkedTasks = await Task.find({ linkedPRId: pr._id })
      .select("title status priority assignees createdAt")
      .populate("assignees", "name email avatar")
      .sort({ updatedAt: -1 });

    res.json({ success: true, pr, linkedTasks });
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Get PR diff
exports.getPullRequestDiff = async (req, res) => {
    try {
        const { id } = req.params;
        const pr = await PullRequest.findById(id);
        if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, req.user.id);

        const diffData = await gitService.getDiff(pr.projectId, pr.baseBranch, pr.headBranch);
        res.json(diffData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new PR
exports.createPullRequest = async (req, res) => {
  try {
    const { projectId, title, description, headBranch, baseBranch = "main", reviewers } = req.body;
    const userId = req.user.id;
    
    // Verify project membership
    const project = await ensureProjectMember(projectId, userId);

    // Validate branch names
    if (!gitService.validateBranchName(baseBranch)) {
      return res.status(400).json({ message: "Invalid baseBranch name" });
    }
    if (!gitService.validateBranchName(headBranch)) {
      return res.status(400).json({ message: "Invalid headBranch name" });
    }

    // Check for duplicate PR
    const existingPr = await PullRequest.findOne({ 
      projectId, 
      headBranch, 
      baseBranch, 
      status: { $in: ['open', 'approved'] } 
    });
    if (existingPr) {
      return res.status(409).json({ 
        message: "Open PR already exists for these branches.",
        prId: existingPr._id 
      });
    }

    // Ensure repo and get diff with commits
    await gitService.initRepo(projectId);
    const diffData = await gitService.getDiff(projectId, baseBranch, headBranch);
    const commits = await gitService.getCommitsBetween(projectId, baseBranch, headBranch);

    // Get next PR number
    const lastPR = await PullRequest.findOne({ projectId })
      .sort({ number: -1 })
      .select("number");
    const number = lastPR ? lastPR.number + 1 : 1;

    const filesChanged = await buildFileChangeEntries(
      projectId,
      baseBranch,
      headBranch,
      diffData.files
    );

    const pr = new PullRequest({
      number,
      projectId,
      title,
      description,
      headBranch,
      baseBranch,
      author: userId,
      status: "open",
      commits: commits || [],
      filesChanged,
      reviewers: reviewers || []
    });

    await pr.save();
    await pr.populate("author", "name email avatar");
    await pr.populate("reviewers", "name email avatar");
    
    const io = req.app.get("io");
    io.to(projectId.toString()).emit("pr_created", pr);
    io.to(projectId.toString()).emit("pr:created", pr);

    // Notify reviewers
    if (reviewers && reviewers.length > 0) {
        const notifications = reviewers.map(reviewerId => ({
          userId: reviewerId,
          type: "pr_review_requested",
          message: `You have been assigned to review PR #${number}: ${title}`,
          referenceId: pr._id,
          projectId,
          payload: { prNumber: number, prTitle: title, author: req.user.name }
        }));
        await Notification.insertMany(notifications);

        for (const reviewerId of reviewers) {
             const notif = await Notification.findOne({ 
               userId: reviewerId, 
               referenceId: pr._id 
             }).sort({ createdAt: -1 });
             if (notif) emitNotification(io, notif);
        }
    }
    
    res.status(201).json({ success: true, pr });
  } catch (error) {
    console.error("Create PR error:", error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Merge PR
exports.mergePullRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { mergeMessage } = req.body;
        const userId = req.user.id;

        const pr = await PullRequest.findById(id).populate("projectId");
        if (!pr) return res.status(404).json({ message: "PR not found" });

        // Can't merge closed or already merged PR
        if (pr.status === "merged") {
          return res.status(400).json({ message: "PR is already merged" });
        }
        if (pr.status === "closed") {
          return res.status(400).json({ message: "Cannot merge a closed PR" });
        }

        // Check permissions (owner/maintainer or PR author)
        const project = pr.projectId;
        const userMember = project.members.find(
          (m) => m.user.toString() === userId.toString()
        );
        const canMerge =
          (userMember && userMember.role === "owner") ||
          pr.author.toString() === userId;

        if (!canMerge) {
          return res.status(403).json({ message: "You do not have permission to merge this PR" });
        }

        // Check approval threshold
        const approvalThreshold = project.approvalThreshold || 1;
        if (pr.approvals.length < approvalThreshold) {
          return res.status(400).json({
            message: `PR needs at least ${approvalThreshold} approval(s) to merge. Current: ${pr.approvals.length}`
          });
        }

        // Attempt merge
        const message = mergeMessage || `Merge PR #${pr.number}: ${pr.title} into ${pr.baseBranch}`;
        const mergeResult = await gitService.merge(
          pr.projectId._id,
          pr.baseBranch,
          pr.headBranch,
          message,
          { name: req.user.name, email: req.user.email }
        );

        if (!mergeResult.success) {
          // Merge conflict
          pr.status = "blocked";
          pr.conflicts = mergeResult.conflicts || [];
          await pr.save();

          return res.status(409).json({
            error: "Merge conflict detected",
            conflicts: mergeResult.conflicts,
            message: "Please resolve conflicts manually"
          });
        }

        // Merge successful
        pr.status = "merged";
        pr.mergeCommitHash = mergeResult.mergeCommitHash;
        pr.mergedBy = userId;
        pr.mergedAt = new Date();
        pr.conflicts = [];
        await pr.save();

        // Create audit record
        await MergeRequestAudit.create({
          prId: pr._id,
          projectId: pr.projectId._id,
          mergedBy: userId,
          mergeCommitHash: mergeResult.mergeCommitHash,
          baseBranch: pr.baseBranch,
          headBranch: pr.headBranch,
          mergeDate: new Date(),
          mergeOutputLog: mergeResult.output || "",
          prSnapshot: {
            title: pr.title,
            description: pr.description,
            author: pr.author,
            approvals: pr.approvals,
            filesChanged: pr.filesChanged,
            commits: pr.commits
          }
        });

        // Update linked tasks to done
        await Task.updateMany(
          { linkedPRId: pr._id, status: { $ne: "done" } },
          { $set: { status: "done" } }
        );

        const updatedTasks = await Task.find({ linkedPRId: pr._id });
        if (req.app.get("io")) {
          updatedTasks.forEach((task) => {
            req.app
              .get("io")
              .to(`project:${task.projectId}`)
              .emit("task:updated", { task, changedFields: ["status"] });
          });
        }

        await pr.populate("author", "name email avatar");
        await pr.populate("mergedBy", "name email avatar");
        
        const io = req.app.get("io");
        io.to(pr.projectId._id.toString()).emit("pr_updated", pr);
        io.to(pr.projectId._id.toString()).emit("pr_merged", { prId: pr._id });
        io.to(pr.projectId._id.toString()).emit("pr:merged", { prId: pr._id });

        // Notify participants
        const notificationRecipients = [
          pr.author.toString(),
          ...pr.reviewers.map(r => r.toString())
        ].filter(id => id !== userId);

        if (notificationRecipients.length > 0) {
          const notifications = notificationRecipients.map(recipientId => ({
            userId: recipientId,
            type: "pr_merged",
            message: `PR #${pr.number}: ${pr.title} has been merged by ${req.user.name}`,
            referenceId: pr._id,
            projectId: pr.projectId._id,
            payload: { prNumber: pr.number, mergedBy: req.user.name }
          }));
          await Notification.insertMany(notifications);
        }

        res.json({ 
          success: true, 
          pr, 
          message: "PR merged successfully",
          mergeCommitHash: mergeResult.mergeCommitHash 
        });
    } catch (error) {
        console.error("Merge PR error:", error);
        res.status(500).json({ message: "Merge failed: " + error.message });
    }
};

// Approve PR
exports.approvePullRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const pr = await PullRequest.findById(id).populate("projectId", "name members approvalThreshold owner");
        if (!pr) return res.status(404).json({ message: "PR not found" });

        await ensureProjectMember(pr.projectId._id, userId);

        // Can't approve your own PR
        if (pr.author.toString() === userId) {
          return res.status(403).json({ message: "Cannot approve your own PR" });
        }

        // Can't approve closed or merged PR
        if (pr.status === "merged" || pr.status === "closed") {
          return res.status(400).json({ message: `Cannot approve a ${pr.status} PR` });
        }

        // Check if user is a reviewer
        const isReviewer = pr.reviewers.some(r => r.toString() === userId);
        if (!isReviewer) {
          return res.status(403).json({ message: "Only assigned reviewers can approve this PR" });
        }

        // Check if already approved
        const alreadyApproved = pr.approvals.some(approval => 
          approval.userId.toString() === userId
        );
        if (alreadyApproved) {
          return res.status(400).json({ message: "You have already approved this PR" });
        }

        // Add approval
        pr.approvals.push({
          userId,
          approvedAt: new Date()
        });

        // Check if has enough approvals
        const approvalThreshold = pr.projectId.approvalThreshold || 1;
        if (pr.approvals.length >= approvalThreshold) {
          pr.status = "approved";
        }

        await pr.save();
        await pr.populate("author", "name email avatar");
        await pr.populate("reviewers", "name email avatar");
        await pr.populate("approvals.userId", "name email avatar");

        const io = req.app.get("io");
        io.to(pr.projectId._id.toString()).emit("pr_updated", pr);
        io.to(pr.projectId._id.toString()).emit("pr_approved", { prId: pr._id, approverId: userId });
        io.to(pr.projectId._id.toString()).emit("pr:approved", { prId: pr._id, approverId: userId });

        // Notify PR author
        await Notification.create({
          userId: pr.author._id,
          type: "pr_approved",
          message: `${req.user.name} approved your PR #${pr.number}: ${pr.title}`,
          referenceId: pr._id,
          projectId: pr.projectId._id,
          payload: { prNumber: pr.number, approver: req.user.name }
        });

        res.json({ success: true, pr, message: "PR approved successfully" });
    } catch (error) {
        console.error("Approve PR error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Update PR
exports.updatePullRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, reviewers } = req.body;
    const userId = req.user.id;
    
    const pr = await PullRequest.findById(id);
    if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, userId);

    // Can't update merged or closed PR
    if (pr.status === "merged" || pr.status === "closed") {
      return res.status(400).json({ message: `Cannot update a ${pr.status} PR` });
    }

    // Only author can update
    if (pr.author.toString() !== userId) {
      return res.status(403).json({ message: "Only the PR author can update details" });
    }

    // Update fields
    if (title !== undefined) pr.title = title;
    if (description !== undefined) pr.description = description;
    if (reviewers !== undefined) {
      pr.reviewers = reviewers;
      // Reset approvals if reviewers changed
      pr.approvals = [];
      pr.status = "open";
    }

    await pr.save();
    await pr.populate("author", "name email avatar");
    await pr.populate("reviewers", "name email avatar");
    
    res.json({ success: true, pr, message: "PR updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Close PR
exports.closePR = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const pr = await PullRequest.findById(id).populate("projectId");
        if (!pr) return res.status(404).json({ message: "PR not found" });

        await ensureProjectMember(pr.projectId._id, userId);

        if (pr.status === "closed") {
          return res.status(400).json({ message: "PR is already closed" });
        }
        if (pr.status === "merged") {
          return res.status(400).json({ message: "Cannot close a merged PR" });
        }

        // Check permissions (owner/maintainer or PR author)
        const project = pr.projectId;
        const userMember = project.members.find(
          (m) => m.user.toString() === userId.toString()
        );
        const canClose =
          (userMember && userMember.role === "owner") ||
          pr.author.toString() === userId;

        if (!canClose) {
          return res.status(403).json({ message: "You do not have permission to close this PR" });
        }

        pr.status = "closed";
        await pr.save();

        const io = req.app.get("io");
        io.to(pr.projectId._id.toString()).emit("pr_updated", pr);

        // Notify PR author if closed by someone else
        if (pr.author.toString() !== userId) {
          await Notification.create({
            userId: pr.author,
            type: "pr_closed",
            message: `Your PR #${pr.number}: ${pr.title} was closed by ${req.user.name}`,
            referenceId: pr._id,
            projectId: pr.projectId._id,
            payload: { prNumber: pr.number, closedBy: req.user.name }
          });
        }

        res.json({ success: true, pr, message: "PR closed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get file contents for PR
exports.getPullRequestFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { filePath } = req.query;
        if (!filePath) return res.status(400).json({ message: "File path required" });

        const pr = await PullRequest.findById(id);
        if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, req.user.id);

        const [baseContent, headContent] = await Promise.all([
            gitService.getFileContent(pr.projectId, pr.baseBranch, filePath),
            gitService.getFileContent(pr.projectId, pr.headBranch, filePath)
        ]);

        res.json({ baseContent, headContent });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get PR comments
exports.getComments = async (req, res) => {
    try {
        const { id } = req.params;
    const pr = await PullRequest.findById(id);
    if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, req.user.id);

    const comments = await ReviewComment.find({ pullRequestId: id })
      .populate("author", "name email avatar")
      .sort({ createdAt: 1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create PR comment
exports.createComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { filePath, lineNumber, content } = req.body;

    const pr = await PullRequest.findById(id);
    if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, req.user.id);

        const comment = new ReviewComment({
            pullRequestId: id,
      projectId: pr.projectId,
            author: req.user.id,
            filePath,
            lineNumber,
            content
        });

        await comment.save();

    const populated = await ReviewComment.findById(comment._id).populate(
      "author",
      "name email avatar"
    );

    const io = req.app.get("io");
    io.to(pr.projectId.toString()).emit("pr_comment_added", populated);
    io.to(pr.projectId.toString()).emit("pr:comment", populated);

        if (pr && pr.author.toString() !== req.user.id) {
             const notif = await createNotification({
                userId: pr.author,
                type: "pr_comment",
                projectId: pr.projectId,
                payload: { prId: pr._id, title: pr.title }
            });
            emitNotification(req.app.get("io"), notif);
        }

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get commit history
exports.getCommitHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const pr = await PullRequest.findById(id);
        if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, req.user.id);

        const commits = await gitService.getCommitHistory(pr.projectId, pr.headBranch, 50);
        res.json(commits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get branches
exports.getBranches = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) return res.status(400).json({ message: "Project ID required" });

    await ensureProjectMember(projectId, req.user.id);

        const branches = await gitService.getBranches(projectId);
        res.json(branches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create branch
exports.createBranch = async (req, res) => {
    try {
        const { projectId, branchName, fromBranch = 'main' } = req.body;
        if (!projectId || !branchName) {
            return res.status(400).json({ message: "Project ID and branch name required" });
        }

    await ensureProjectMember(projectId, req.user.id);

        await gitService.createBranch(projectId, branchName, fromBranch);
        res.json({ message: "Branch created successfully", branchName });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Legacy compatibility
exports.rejectPullRequest = exports.closePR;
exports.getPullRequestDetail = exports.getPullRequestById;

// Link a file to PR
exports.linkFileToPullRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ message: "fileId is required" });
    }

    const pr = await PullRequest.findById(id);
    if (!pr) return res.status(404).json({ message: "PR not found" });

    await ensureProjectMember(pr.projectId, req.user.id);

    const attachment = await Attachment.findById(fileId);
    if (!attachment || attachment.isDeleted) {
      return res.status(404).json({ message: "File not found" });
    }

    if (attachment.projectId.toString() !== pr.projectId.toString()) {
      return res.status(400).json({ message: "File must belong to the same project" });
    }

    attachment.relatedPR = pr._id;
    await attachment.save();
    await attachment.populate("uploadedBy", "name email avatar");

    const io = req.app.get("io");
    if (io) {
      io.to(`project:${pr.projectId}`).emit("file:linked", {
        fileId: attachment._id,
        relatedPR: pr._id,
      });
    }

    res.json({ success: true, attachment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
