const PullRequest = require("../models/PullRequest");
const ReviewComment = require("../models/ReviewComment");
const { createNotification } = require("../utils/notify");

exports.getPullRequests = async (req, res) => {
  try {
    const { projectId } = req.query;
    const prs = await PullRequest.find({ projectId })
      .populate("author", "name email")
      .populate("reviewers", "name email")
      .sort({ createdAt: -1 });
    res.json(prs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPullRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const pr = await PullRequest.findById(id)
      .populate("author", "name email")
      .populate("reviewers", "name email");
      
    if (!pr) return res.status(404).json({ message: "PR not found" });
    
    res.json(pr);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPullRequest = async (req, res) => {
  try {
    const { projectId, title, description, headBranch, baseBranch } = req.body;
    
    const pr = new PullRequest({
      projectId,
      title,
      description,
      headBranch,
      baseBranch: baseBranch || "main",
      author: req.user.id,
      status: "open"
    });

    await pr.save();
    
    // Notify project members? (Maybe just specific ones later)
    
    res.status(201).json(pr);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePullRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const pr = await PullRequest.findByIdAndUpdate(id, req.body, { new: true })
        .populate("author", "name email");
    res.json(pr);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.mergePullRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const pr = await PullRequest.findByIdAndUpdate(id, { status: "merged" }, { new: true });
        
        await createNotification({
            userId: pr.author,
            type: "pr_merged",
            projectId: pr.projectId,
            payload: { prId: pr._id, title: pr.title }
        });

        res.json(pr);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Comments
exports.getComments = async (req, res) => {
    try {
        const { id } = req.params; // PR ID
        const comments = await ReviewComment.find({ pullRequestId: id })
            .populate("author", "name email")
            .sort({ createdAt: 1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createComment = async (req, res) => {
    try {
        const { id } = req.params; // PR ID
        const { filePath, lineNumber, content } = req.body;

        const comment = new ReviewComment({
            pullRequestId: id,
            author: req.user.id,
            filePath,
            lineNumber,
            content
        });

        await comment.save();
        
        const pr = await PullRequest.findById(id);
        if (pr && pr.author.toString() !== req.user.id) {
             await createNotification({
                userId: pr.author,
                type: "pr_comment",
                projectId: pr.projectId,
                payload: { prId: pr._id, title: pr.title }
            });
        }

        const populated = await ReviewComment.findById(comment._id).populate("author", "name email");
        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
