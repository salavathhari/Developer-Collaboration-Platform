const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const REPOS_DIR = path.join(__dirname, '../../repos');

// Ensure repos directory exists
if (!fs.existsSync(REPOS_DIR)) {
  fs.mkdirSync(REPOS_DIR, { recursive: true });
}

// Validation regexes to prevent command injection
const BRANCH_NAME_REGEX = /^[A-Za-z0-9._\/-]{1,255}$/;
const FILE_PATH_REGEX = /^[A-Za-z0-9._\/ -]{1,1024}$/;
const COMMIT_MESSAGE_MAX_LENGTH = 5000;

/**
 * Validate branch name to prevent command injection
 */
function validateBranchName(branchName) {
  if (!branchName || typeof branchName !== "string") {
    throw new Error("Branch name must be a non-empty string");
  }
  if (!BRANCH_NAME_REGEX.test(branchName)) {
    throw new Error("Invalid branch name format");
  }
  return branchName;
}

/**
 * Validate file path to prevent directory traversal
 */
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("File path must be a non-empty string");
  }
  if (!FILE_PATH_REGEX.test(filePath)) {
    throw new Error("Invalid file path format");
  }
  if (filePath.includes("..") || path.isAbsolute(filePath)) {
    throw new Error("File path cannot contain .. or be absolute");
  }
  return filePath;
}

/**
 * Execute git command safely using spawn (prevents shell injection)
 */
function execGitCommand(repoPath, args, options = {}) {
  return new Promise((resolve, reject) => {
    const git = spawn("git", args, {
      cwd: repoPath,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      ...options,
    });

    let stdout = "";
    let stderr = "";

    git.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    git.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    git.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
      } else {
        reject(new Error(`Git command failed (${code}): ${stderr || stdout}`));
      }
    });

    git.on("error", (error) => {
      reject(new Error(`Failed to execute git: ${error.message}`));
    });
  });
}

class GitService {
  constructor() {
    this.reposDir = REPOS_DIR;
  }

  getRepoPath(projectId) {
    return path.join(this.reposDir, projectId.toString());
  }

  /**
   * Initialize repository
   */
  async initRepo(projectId) {
    const repoPath = this.getRepoPath(projectId);
    if (!fs.existsSync(repoPath)) {
      fs.mkdirSync(repoPath, { recursive: true });
      
      await execGitCommand(repoPath, ["init"]);
      await execGitCommand(repoPath, ["config", "user.email", "bot@devcollab.com"]);
      await execGitCommand(repoPath, ["config", "user.name", "DevCollab Bot"]);
      
      // Create initial commit
      fs.writeFileSync(path.join(repoPath, 'README.md'), '# New Project\n\nWelcome to your DevCollab project!');
      await execGitCommand(repoPath, ["add", "."]);
      await execGitCommand(repoPath, ["commit", "-m", "Initial commit"]);
    }
    return repoPath;
  }

  /**
   * Create new branch from existing branch (SAFE)
   */
  async createBranch(projectId, branchName, fromBranch = 'main') {
    validateBranchName(branchName);
    validateBranchName(fromBranch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      // Check if from branch exists
      await execGitCommand(repoPath, ["rev-parse", "--verify", fromBranch]);
      
      // Create branch
      await execGitCommand(repoPath, ["branch", branchName, fromBranch]);
      return { success: true, branch: branchName };
    } catch (error) {
      if (error.message.includes("already exists")) {
        // Branch exists, just return success
        return { success: true, branch: branchName, existed: true };
      }
      throw error;
    }
  }

  /**
   * Check if branch exists
   */
  async branchExists(projectId, branchName) {
    validateBranchName(branchName);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      await execGitCommand(repoPath, ["rev-parse", "--verify", branchName]);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all branches (SAFE)
   */
  async getBranches(projectId) {
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, ["branch", "--list", "--all"]);
      const branches = result.stdout
        .split("\n")
        .map((line) => line.trim().replace(/^\* /, "").replace(/^remotes\/origin\//, ""))
        .filter((line) => line && !line.includes("HEAD ->"));
      
      return [...new Set(branches)];
    } catch (error) {
      return ['main'];
    }
  }

  /**
   * Get diff summary between branches (SAFE)
   */
  async getDiff(projectId, baseBranch, headBranch) {
    validateBranchName(baseBranch);
    validateBranchName(headBranch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      // Get raw diff
      const diffResult = await execGitCommand(repoPath, ["diff", `${baseBranch}...${headBranch}`]);
      
      // Get numstat for file stats
      const numstatResult = await execGitCommand(repoPath, [
        "diff",
        "--numstat",
        `${baseBranch}...${headBranch}`,
      ]);

      const files = [];
      const numstatLines = numstatResult.stdout.split("\n").filter(Boolean);

      numstatLines.forEach((line) => {
        const [additions, deletions, ...pathParts] = line.split(/\s+/);
        const file = pathParts.join(" ");
        
        files.push({
          file,
          path: file,
          additions: additions === "-" ? 0 : parseInt(additions, 10) || 0,
          deletions: deletions === "-" ? 0 : parseInt(deletions, 10) || 0,
          status: "modified",
        });
      });

      return {
        rawDiff: diffResult.stdout,
        files,
      };
    } catch (error) {
      return { rawDiff: "", files: [] };
    }
  }

  /**
   * Get detailed diff for specific file (SAFE)
   */
  async getDiffForFile(projectId, baseBranch, headBranch, filePath) {
    validateBranchName(baseBranch);
    validateBranchName(headBranch);
    validateFilePath(filePath);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, [
        "diff",
        `${baseBranch}...${headBranch}`,
        "--",
        filePath,
      ]);
      return result.stdout;
    } catch (error) {
      return "";
    }
  }

  /**
   * Get commits between branches (SAFE)
   */
  async getCommitsBetween(projectId, baseBranch, headBranch) {
    validateBranchName(baseBranch);
    validateBranchName(headBranch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, [
        "log",
        `${baseBranch}..${headBranch}`,
        "--pretty=format:%H|||%an|||%ae|||%ai|||%s",
        "--no-merges",
      ]);

      if (!result.stdout) {
        return [];
      }

      const commits = result.stdout.split("\n").map((line) => {
        const [hash, author, email, date, message] = line.split("|||");
        return {
          hash,
          author,
          email,
          timestamp: new Date(date).getTime(),
          date: new Date(date),
          message,
        };
      });

      return commits;
    } catch (error) {
      return [];
    }
  }

  /**
   * Merge branches (SAFE) - Returns conflict info if any
   */
  async merge(projectId, baseBranch, headBranch, mergeMessage = null) {
    validateBranchName(baseBranch);
    validateBranchName(headBranch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      // Checkout base branch
      await execGitCommand(repoPath, ["checkout", baseBranch]);
      
      // Attempt merge
      const mergeArgs = ["merge", headBranch, "--no-ff"];
      if (mergeMessage) {
        mergeArgs.push("-m", mergeMessage);
      } else {
        mergeArgs.push("-m", `Merge ${headBranch} into ${baseBranch}`);
      }

      try {
        await execGitCommand(repoPath, mergeArgs);
        
        // Get merge commit hash
        const hashResult = await execGitCommand(repoPath, ["rev-parse", "HEAD"]);
        const mergeCommitHash = hashResult.stdout.trim();

        return {
          success: true,
          mergeCommitHash,
          conflicts: [],
        };
      } catch (mergeError) {
        // Check for conflicts
        if (mergeError.message.includes("conflict") || mergeError.message.includes("CONFLICT")) {
          // Get conflicted files
          try {
            const statusResult = await execGitCommand(repoPath, ["diff", "--name-only", "--diff-filter=U"]);
            const conflictedFiles = statusResult.stdout.split("\n").filter(Boolean);

            // Abort merge
            await execGitCommand(repoPath, ["merge", "--abort"]);

            return {
              success: false,
              conflicts: conflictedFiles,
              message: "Merge conflicts detected",
            };
          } catch (abortError) {
            throw new Error(`Merge failed with conflicts: ${mergeError.message}`);
          }
        }

        throw mergeError;
      }
    } catch (error) {
      throw new Error(`Merge operation failed: ${error.message}`);
    }
  }

  /**
   * Commit file changes (SAFE)
   */
  async commitFile(projectId, branch, filePath, content, message, author = null) {
    validateBranchName(branch);
    validateFilePath(filePath);
    
    if (message.length > COMMIT_MESSAGE_MAX_LENGTH) {
      throw new Error("Commit message too long");
    }
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      // Checkout branch
      await execGitCommand(repoPath, ["checkout", branch]);
      
      // Write file
      const fullPath = path.join(repoPath, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
      
      // Configure author if provided
      if (author && author.name && author.email) {
        await execGitCommand(repoPath, ["config", "user.name", author.name]);
        await execGitCommand(repoPath, ["config", "user.email", author.email]);
      }
      
      // Add and commit
      await execGitCommand(repoPath, ["add", filePath]);
      await execGitCommand(repoPath, ["commit", "-m", message]);
      
      return { success: true };
    } catch (error) {
      if (error.message.includes("nothing to commit")) {
        return { success: true, noChanges: true };
      }
      throw error;
    }
  }

  /**
   * Get file content at specific branch (SAFE)
   */
  async getFileContent(projectId, branch, filePath) {
    validateBranchName(branch);
    validateFilePath(filePath);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, ["show", `${branch}:${filePath}`]);
      return result.stdout;
    } catch (error) {
      return "";
    }
  }

  /**
   * Alias for getFileContent (SAFE)
   */
  async showFile(projectId, branch = 'main', filePath) {
    return this.getFileContent(projectId, branch, filePath);
  }

  /**
   * Get commit history for branch (SAFE)
   */
  async getCommitHistory(projectId, branch = 'main', limit = 20) {
    validateBranchName(branch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, [
        "log",
        branch,
        `--max-count=${limit}`,
        "--pretty=format:%H|%an|%ae|%at|%s",
      ]);
      
      if (!result.stdout) return [];
      
      return result.stdout.split('\n').filter(Boolean).map(line => {
        const [hash, author, email, timestamp, message] = line.split('|');
        return {
          hash,
          author,
          email,
          timestamp: parseInt(timestamp) * 1000,
          message
        };
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Get commit log with relative time (SAFE)
   */
  async getLog(projectId, branch = 'main', limit = 50) {
    validateBranchName(branch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, [
        "log",
        branch,
        `--max-count=${limit}`,
        "--pretty=format:%h|%an|%ar|%s",
      ]);
      
      if (!result.stdout) return [];

      return result.stdout.split('\n').filter(Boolean).map(line => {
        const [hash, author, timeAgo, message] = line.split('|');
        return { hash, author, timeAgo, message };
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Get latest commit (SAFE)
   */
  async getLatestCommit(projectId, branch = 'main') {
    validateBranchName(branch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const result = await execGitCommand(repoPath, [
        "log",
        branch,
        "--max-count=1",
        "--pretty=format:%h|%an|%ar|%s",
      ]);
      
      if (!result.stdout) return null;
      
      const [hash, author, timeAgo, message] = result.stdout.split('|');
      return { hash, author, timeAgo, message };
    } catch (error) {
      return null;
    }
  }

  /**
   * List files in repository at specific path (SAFE)
   */
  async listFiles(projectId, branch = 'main', directory = '') {
    validateBranchName(branch);
    if (directory) {
      validateFilePath(directory);
    }
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      const treePath = directory ? `${branch}:${directory}` : branch;
      const result = await execGitCommand(repoPath, ["ls-tree", treePath]);
      
      if (!result.stdout) return [];

      const files = result.stdout.split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        const mode = parts[0];
        const type = parts[1];
        const hash = parts[2];
        const name = parts.slice(3).join(' ').replace(/\t/g, '');
        
        return {
          name,
          type: type === 'tree' ? 'folder' : 'file',
          path: directory ? `${directory}/${name}` : name,
          mode,
          hash
        };
      });

      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Upload file and commit (SAFE)
   */
  async uploadFile(projectId, branch, filePath, content, commitMessage, author) {
    validateBranchName(branch);
    validateFilePath(filePath);
    
    if (commitMessage.length > COMMIT_MESSAGE_MAX_LENGTH) {
      throw new Error("Commit message too long");
    }
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      // Checkout branch
      await execGitCommand(repoPath, ["checkout", branch]);
      
      // Write file
      const fullPath = path.join(repoPath, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
      
      // Configure author
      if (author && author.name && author.email) {
        await execGitCommand(repoPath, ["config", "user.name", author.name]);
        await execGitCommand(repoPath, ["config", "user.email", author.email]);
      }
      
      // Add and commit
      await execGitCommand(repoPath, ["add", filePath]);
      await execGitCommand(repoPath, ["commit", "-m", commitMessage]);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get repository stats (SAFE)
   */
  async getRepoStats(projectId, branch = 'main') {
    validateBranchName(branch);
    
    await this.initRepo(projectId);
    const repoPath = this.getRepoPath(projectId);
    
    try {
      // Count commits
      const commitResult = await execGitCommand(repoPath, ["rev-list", "--count", branch]);
      const commitCount = parseInt(commitResult.stdout) || 0;
      
      // Count contributors
      const contributorsResult = await execGitCommand(repoPath, [
        "log",
        branch,
        "--format=%an",
      ]);
      const contributors = [...new Set(contributorsResult.stdout.split('\n').filter(Boolean))];
      
      // Count files
      const filesResult = await execGitCommand(repoPath, ["ls-tree", "-r", branch, "--name-only"]);
      const fileCount = filesResult.stdout.split('\n').filter(Boolean).length;
      
      return {
        commitCount,
        contributorCount: contributors.length,
        fileCount
      };
    } catch (error) {
      return { commitCount: 0, contributorCount: 0, fileCount: 0 };
    }
  }

  /**
   * Check if repository exists
   */
  repoExists(projectId) {
    const repoPath = this.getRepoPath(projectId);
    return fs.existsSync(path.join(repoPath, '.git'));
  }
}

module.exports = new GitService();
