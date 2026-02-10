const Repository = require("../models/Repository");
const Commit = require("../models/Commit");
const File = require("../models/File");
const Project = require("../models/Project");
const crypto = require("crypto");
const { createNotification, emitNotification } = require("../utils/notify");
const gitService = require("../services/gitService");
const path = require('path');

// ============================================
// GIT-BASED REPOSITORY CONTROLLERS (Real Git Integration)
// ============================================

/**
 * Initialize Git repository for project
 * POST /api/repos/init
 */
exports.initGitRepo = async (req, res) => {
    try {
        const { projectId } = req.body;
        
        // Verify project exists and user is member
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Check if user is project member
        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Check if repo already exists
        if (gitService.repoExists(projectId)) {
            return res.json({ message: "Repository already exists", exists: true });
        }

        // Initialize Git repository
        await gitService.initRepo(projectId);

        res.status(201).json({ 
            message: "Repository initialized successfully",
            projectId,
            path: gitService.getRepoPath(projectId)
        });

    } catch (error) {
        console.error('initGitRepo error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * List files in repository
 * GET /api/repos/:projectId/files?branch=main&path=
 */
exports.listRepoFiles = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main', path: directory = '' } = req.query;

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Ensure repo exists
        if (!gitService.repoExists(projectId)) {
            await gitService.initRepo(projectId);
        }

        // List files
        const files = await gitService.listFiles(projectId, branch, directory);

        res.json({ files });

    } catch (error) {
        console.error('listRepoFiles error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get file content
 * GET /api/repos/:projectId/file-content?branch=main&path=file.js
 */
exports.getFileContent = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main', path: filePath } = req.query;

        if (!filePath) {
            return res.status(400).json({ message: "File path required" });
        }

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Validate file path (prevent directory traversal)
        if (filePath.includes('..') || filePath.startsWith('/')) {
            return res.status(400).json({ message: "Invalid file path" });
        }

        // Get file content
        const content = await gitService.showFile(projectId, branch, filePath);
        
        if (content === null) {
            return res.status(404).json({ message: "File not found" });
        }

        res.json({ 
            content,
            path: filePath,
            branch
        });

    } catch (error) {
        console.error('getFileContent error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get commit history
 * GET /api/repos/:projectId/commits?branch=main&limit=50
 */
exports.getCommitHistory = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main', limit = 50 } = req.query;

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Get commits
        const commits = await gitService.getLog(projectId, branch, parseInt(limit));

        res.json({ commits });

    } catch (error) {
        console.error('getCommitHistory error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Upload file to repository
 * POST /api/repos/:projectId/upload
 */
exports.uploadFileToRepo = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main', path: filePath, content, message } = req.body;

        if (!filePath || content === undefined) {
            return res.status(400).json({ message: "File path and content required" });
        }

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Validate file path
        if (filePath.includes('..') || filePath.startsWith('/')) {
            return res.status(400).json({ message: "Invalid file path" });
        }

        // Ensure repo exists
        if (!gitService.repoExists(projectId)) {
            await gitService.initRepo(projectId);
        }

        // Get user info from req.user
        const User = require("../models/User");
        const user = await User.findById(req.user.id);

        // Upload file
        await gitService.uploadFile(
            projectId,
            branch,
            filePath,
            content,
            message || `Add ${path.basename(filePath)}`,
            { name: user.name, email: user.email }
        );

        res.status(201).json({ 
            message: "File uploaded successfully",
            path: filePath
        });

    } catch (error) {
        console.error('uploadFileToRepo error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Upload multiple files to repository
 * POST /api/repos/:projectId/upload-multiple
 */
exports.uploadMultipleFiles = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main', files, message, description } = req.body;

        console.log('Upload request received:', {
            projectId,
            branch,
            filesCount: files?.length,
            hasMessage: !!message,
            firstFile: files?.[0]
        });

        if (!files || !Array.isArray(files) || files.length === 0) {
            console.log('Validation failed: No files array');
            return res.status(400).json({ message: "Files array required" });
        }

        if (!message) {
            console.log('Validation failed: No message');
            return res.status(400).json({ message: "Commit message required" });
        }

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Validate all file paths
        for (const file of files) {
            if (!file.path || file.content === undefined) {
                console.log('Validation failed: Invalid file structure', file);
                return res.status(400).json({ message: "Each file must have path and content" });
            }
            if (file.path.includes('..') || file.path.startsWith('/')) {
                console.log('Validation failed: Invalid path', file.path);
                return res.status(400).json({ message: `Invalid file path: ${file.path}` });
            }
        }

        // Ensure repo exists
        await gitService.initRepo(projectId);
        
        // Get user info
        const User = require("../models/User");
        const user = await User.findById(req.user.id);

        // Create full commit message
        const fullMessage = description ? `${message}\n\n${description}` : message;

        // Use gitService's commitFile method for each file, or write custom logic
        const repoPath = gitService.getRepoPath(projectId);
        const fs = require('fs');
        const { spawn } = require('child_process');
        
        // Helper to execute git commands
        const execGitCommand = (args) => {
            return new Promise((resolve, reject) => {
                const git = spawn('git', args, {
                    cwd: repoPath,
                    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
                });
                
                let stdout = '';
                let stderr = '';
                
                git.stdout.on('data', (data) => { stdout += data.toString(); });
                git.stderr.on('data', (data) => { stderr += data.toString(); });
                
                git.on('close', (code) => {
                    if (code === 0) {
                        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
                    } else {
                        reject(new Error(`Git command failed (${code}): ${stderr || stdout}`));
                    }
                });
                
                git.on('error', (error) => {
                    reject(new Error(`Failed to execute git: ${error.message}`));
                });
            });
        };

        // Checkout branch
        try {
            await execGitCommand(['checkout', branch]);
        } catch (err) {
            // Branch might not exist, create it
            try {
                await gitService.createBranch(projectId, branch);
                await execGitCommand(['checkout', branch]);
            } catch (createErr) {
                return res.status(400).json({ message: `Failed to checkout or create branch: ${createErr.message}` });
            }
        }

        // Write all files
        for (const file of files) {
            const fullPath = path.join(repoPath, file.path);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, file.content);
        }

        // Configure author
        await execGitCommand(['config', 'user.name', user.name || 'DevCollab User']);
        await execGitCommand(['config', 'user.email', user.email || 'user@devcollab.com']);

        // Add all files and commit
        await execGitCommand(['add', '.']);
        await execGitCommand(['commit', '-m', fullMessage]);

        res.status(201).json({ 
            message: "Files uploaded successfully",
            count: files.length,
            branch
        });

    } catch (error) {
        console.error('uploadMultipleFiles error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create a new branch
 * POST /api/repos/:projectId/branch
 */
exports.createGitBranch = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branchName, fromBranch = 'main' } = req.body;

        if (!branchName) {
            return res.status(400).json({ message: "Branch name required" });
        }

        // Validate branch name
        if (!/^[a-zA-Z0-9/_-]+$/.test(branchName)) {
            return res.status(400).json({ 
                message: "Branch name can only contain letters, numbers, hyphens, underscores, and slashes" 
            });
        }

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Ensure repo exists
        if (!gitService.repoExists(projectId)) {
            await gitService.initRepo(projectId);
        }

        // Check if branch already exists
        const branches = await gitService.listBranches(projectId);
        if (branches.includes(branchName)) {
            return res.status(400).json({ message: "Branch already exists" });
        }

        // Create branch
        await gitService.createBranch(projectId, branchName, fromBranch);

        res.status(201).json({ 
            message: "Branch created successfully",
            branchName,
            fromBranch
        });

    } catch (error) {
        console.error('createGitBranch error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get repository statistics
 * GET /api/repos/:projectId/stats?branch=main
 */
exports.getRepoStats = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main' } = req.query;

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Get stats
        const stats = await gitService.getRepoStats(projectId, branch);

        res.json(stats);

    } catch (error) {
        console.error('getRepoStats error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get latest commit
 * GET /api/repos/:projectId/latest-commit?branch=main
 */
exports.getLatestCommit = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { branch = 'main' } = req.query;

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const latestCommit = await gitService.getLatestCommit(projectId, branch);

        res.json(latestCommit || {});

    } catch (error) {
        console.error('getLatestCommit error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get available branches
 * GET /api/repos/:projectId/branches
 */
exports.listBranches = async (req, res) => {
    try {
        const { projectId } = req.params;

        // Verify access
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isMember = project.members.some(m => m.user.toString() === req.user.id) || 
                        project.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const branches = await gitService.getBranches(projectId);

        res.json({ branches });

    } catch (error) {
        console.error('listBranches error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ============================================
// LEGACY MONGODB-BASED CONTROLLERS (Keep for backward compatibility)
// ============================================

exports.createRepository = async (req, res) => {
  try {
    const { projectId, name, description } = req.body;
    
    const existing = await Repository.findOne({ projectId });
    if (existing) {
        return res.status(400).json({ message: "Project already has a repository" });
    }

    const repo = new Repository({
      projectId,
      name: name || "main-repo",
      description,
      owner: req.user.id,
      branches: []
    });

    await repo.save();

    // Create Initial File (README.md)
    const readmeContent = `# ${repo.name}\n\n${description || ''}`;
    const initialFile = new File({
        repoId: repo._id,
        branch: "main",
        filePath: "README.md",
        fileName: "README.md",
        content: readmeContent,
        lastModifiedBy: req.user.id
    });
    await initialFile.save();

    // Create Initial Commit
    const initialCommit = new Commit({
       repositoryId: repo._id,
       author: req.user.id,
       message: "Initial commit",
       branch: "main",
       commitHash: crypto.randomBytes(10).toString('hex'),
       filesChanged: [{
           path: "README.md",
           type: "add",
           newContent: readmeContent
       }],
       stats: { additions: 1, deletions: 0 }
    });
    
    await initialCommit.save();

    // Update Head
    repo.branches.push({ name: "main", headCommit: initialCommit._id });
    await repo.save();

    res.status(201).json(repo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRepository = async (req, res) => {
    try {
        const { projectId } = req.params;
        const repo = await Repository.findOne({ projectId })
            .populate("branches.headCommit");
        if (!repo) return res.status(404).json({ message: "Repository not found" });
        res.json(repo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Simple Commit Implementation (Snapshot based)
exports.commitChanges = async (req, res) => {
    try {
        const { repoId } = req.params;
        const { message, branchName, files } = req.body; // files: [{ path, content }]

        const repo = await Repository.findById(repoId);
        if (!repo) return res.status(404).json({ message: "Repo not found" });

        const branch = repo.branches.find(b => b.name === branchName);
        if (!branch) return res.status(404).json({ message: "Branch not found" });

        // Get parent commit state
        const parentCommit = await Commit.findById(branch.headCommit);
        
        let newFileStructure = [];
        if (parentCommit) {
            // Clone existing files
            newFileStructure = [...parentCommit.fileStructure];
        }

        // Apply changes
        let additions = 0;
        let deletions = 0;

        files.forEach(change => {
            const idx = newFileStructure.findIndex(f => f.path === change.path);
            if (idx >= 0) {
                // Update or Delete
                if (change.content === null) {
                    // Delete
                    newFileStructure.splice(idx, 1);
                    deletions++;
                } else {
                    // Update
                    newFileStructure[idx].content = change.content;
                    additions++; // simplistic stat
                }
            } else if (change.content !== null) {
                // Create
                newFileStructure.push({ path: change.path, content: change.content, type: 'file' });
                additions++;
            }
        });

        const newCommit = new Commit({
            repositoryId: repo._id,
            author: req.user.id,
            message,
            branch: branchName,
            parentCommit: parentCommit ? parentCommit._id : null,
            fileStructure: newFileStructure,
            stats: { additions, deletions }
        });

        await newCommit.save();

        // Update Branch Ref
        const branchIdx = repo.branches.findIndex(b => b.name === branchName);
        repo.branches[branchIdx].headCommit = newCommit._id;
        await repo.save();

        // Notify Project Members
        const project = await Project.findById(repo.projectId);
        if (project) {
            // Get all members + owner excluding sender
            const recipients = [...project.members.map(m => m.user), project.owner]
                .filter(uid => uid.toString() !== req.user.id);
            
            for (const recipientId of recipients) {
                const notif = await createNotification({
                    userId: recipientId,
                    type: "commit",
                    projectId: repo.projectId,
                    payload: { 
                        repoId: repo._id, 
                        commitId: newCommit._id,
                        message: `New commit in ${repo.name}: ${message}`
                    }
                });
                // Assuming we have io available via req.app.get('io') or similar
                const io = req.app.get("io");
                if (io) emitNotification(io, notif);
            }
        }

        res.status(201).json(newCommit);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

exports.getCommits = async (req, res) => {
    try {
        const { repoId } = req.params;
        const { branch } = req.query;
        
        const query = { repositoryId: repoId };
        // If branch is specific, we might follow parent pointers, but for simple MVP
        // we can filter by 'branch' field if we stored it (which we did).
        // A real git history requires traversing parents.
        if (branch) query.branch = branch;

        const commits = await Commit.find(query)
            .sort({ createdAt: -1 })
            .populate("author", "name email")
            .limit(50);
            
        res.json(commits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getRepoFiles = async (req, res) => {
    try {
        const { repoId } = req.params;
        const { branch, commitId, path } = req.query;

        let targetCommitId = commitId;

        if (!targetCommitId && branch) {
            const repo = await Repository.findById(repoId);
            const b = repo.branches.find(br => br.name === branch);
            if(b) targetCommitId = b.headCommit;
        }

        if (!targetCommitId) {
             // Fallback to default branch
             const repo = await Repository.findById(repoId);
             if(!repo) return res.status(404).json({ message: "Repo not found" });
             
             const b = repo.branches.find(br => br.name === repo.defaultBranch);
             if(b) targetCommitId = b.headCommit;
        }

        const commit = await Commit.findById(targetCommitId);
        if(!commit) return res.status(404).json({ message: "Commit not found" });

        // If path is provided, find that specific file
        if (path) {
            const file = commit.fileStructure.find(f => f.path === path);
            if (!file) return res.status(404).json({ message: "File not found" });
            return res.json(file);
        }

        // Return tree (exclude content for bandwidth if list is large, but MVP is okay)
        // Let's stripping content for the tree view
        const tree = commit.fileStructure.map(f => ({ path: f.path, type: f.type }));
        res.json(tree);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createBranch = async (req, res) => {
    try {
        const { repoId } = req.params;
        const { name, sourceBranch } = req.body;

        const repo = await Repository.findById(repoId);
        if (!repo) return res.status(404).json({ message: "Repo not found" });
        
        if (repo.branches.find(b => b.name === name)) {
             return res.status(400).json({ message: "Branch already exists" });
        }

        const source = repo.branches.find(b => b.name === (sourceBranch || repo.defaultBranch));
        if (!source) return res.status(404).json({ message: "Source branch not found" });

        repo.branches.push({ name, headCommit: source.headCommit });
        await repo.save();

        res.json(repo);

    } catch(error) {
        res.status(500).json({ message: error.message });
    }
}
