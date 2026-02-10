const Repository = require('../models/Repository');
const File = require('../models/File');
const Commit = require('../models/Commit');
const CodeComment = require('../models/CodeComment');
const { createNotification } = require('../utils/notify');
const Diff = require('diff');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const gitService = require('../services/gitService');

// Helper to generate hash
const generateHash = () => crypto.randomBytes(10).toString('hex');

// Get Repository Details
exports.getRepo = async (req, res) => {
    try {
        const { projectId } = req.params;
        const repo = await Repository.findOne({ projectId })
                      .populate('branches.headCommit')
                      .populate('owner', 'name avatar');
        
        if (!repo) return res.status(404).json({ message: 'Repository not found' });
        res.json(repo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Browse Files (File Explorer)
exports.getFiles = async (req, res) => {
    try {
        const { repoId } = req.params;
        const { branch = 'main' } = req.query;
        
        const files = await File.find({ repoId, branch })
            .select('filePath fileName isDirectory updatedAt lastModifiedBy')
            .populate('lastModifiedBy', 'name');

        res.json(files);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Single File Content
exports.getFileContent = async (req, res) => {
    try {
        const { fileId } = req.params;
        const file = await File.findById(fileId).populate('lastModifiedBy', 'name');
        if (!file) return res.status(404).json({ message: 'File not found' });
        
        res.json(file);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a Commit (Update Files)
exports.commitChanges = async (req, res) => {
    try {
        const { repoId, message, branch = 'main', files } = req.body; 
        
        const repo = await Repository.findById(repoId);
        if (!repo) return res.status(404).json({ message: 'Repository not found' });

        const changes = [];
        let additions = 0;
        let deletions = 0;

        for (const f of files) {
            let existingFile = await File.findOne({ repoId, branch, filePath: f.path });
            let oldContent = existingFile ? existingFile.content : '';
            let type = existingFile ? (f.isDelete ? 'delete' : 'modify') : 'add';

            if (!f.isDelete) additions += 1; 
            if (f.isDelete) deletions += 1;

            if (type === 'add' || type === 'modify') {
                if (!existingFile) {
                    existingFile = new File({
                        repoId,
                        branch,
                        filePath: f.path,
                        fileName: f.path.split('/').pop(),
                        content: f.content,
                        lastModifiedBy: req.user.id
                    });
                } else {
                    existingFile.content = f.content;
                    existingFile.lastModifiedBy = req.user.id;
                }
                await existingFile.save();
            } else if (type === 'delete' && existingFile) {
                await File.deleteOne({ _id: existingFile._id });
            }

            changes.push({
                path: f.path,
                type,
                oldContent: type === 'add' ? '' : oldContent,
                newContent: type === 'delete' ? '' : f.content
            });
        }

        // Sync to Git
        try {
            await gitService.initRepo(repo.projectId);
            try {
                await gitService.run(repo.projectId, `git checkout ${branch}`);
            } catch (e) {
                await gitService.run(repo.projectId, `git checkout -b ${branch}`);
            }

            for (const f of files) {
                const fullPath = path.join(gitService.getRepoPath(repo.projectId), f.path);
                if (f.isDelete) {
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath); 
                } else {
                    const dir = path.dirname(fullPath);
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(fullPath, f.content);
                }
            }
            await gitService.run(repo.projectId, 'git add .');
            try {
                 await gitService.run(repo.projectId, `git commit -m "${message}"`);
            } catch(e) {}
        } catch (gitError) {
            console.error("Git sync failed:", gitError);
        }

        const newCommit = new Commit({
            repositoryId: repoId,
            author: req.user.id,
            message,
            branch,
            commitHash: generateHash(),
            filesChanged: changes,
            stats: { additions, deletions }
        });

        await newCommit.save();

        const branchIdx = repo.branches.findIndex(b => b.name === branch);
        if (branchIdx >= 0) {
            repo.branches[branchIdx].headCommit = newCommit._id;
        } else {
            repo.branches.push({ name: branch, headCommit: newCommit._id });
        }
        await repo.save();

        res.status(201).json(newCommit);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Upload File (New)
exports.uploadFile = async (req, res) => {
    try {
        const { repoId, branch = 'main', filePath } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const repo = await Repository.findById(repoId);
        if (!repo) return res.status(404).json({ message: 'Repository not found' });

        let content = '';
        try {
            content = fs.readFileSync(file.path, 'utf8');
        } catch (readError) {
            return res.status(500).json({ message: 'Failed to read file content' });
        }

        // Clean up
        fs.unlinkSync(file.path);

        const targetPath = filePath || file.originalname;
        const fileName = path.basename(targetPath);
        
        let existingFile = await File.findOne({ repoId, branch, filePath: targetPath });
        let type = existingFile ? 'modify' : 'add';
        let oldContent = existingFile ? existingFile.content : '';

        if (!existingFile) {
            existingFile = new File({
                repoId,
                branch,
                filePath: targetPath,
                fileName,
                content,
                lastModifiedBy: req.user.id
            });
        } else {
            existingFile.content = content;
            existingFile.lastModifiedBy = req.user.id;
        }

        await existingFile.save();

        const newCommit = new Commit({
            repositoryId: repoId,
            author: req.user.id,
            message: `Uploaded ${fileName}`,
            branch,
            commitHash: generateHash(),
            filesChanged: [{
                path: targetPath,
                type,
                oldContent: type === 'add' ? '' : oldContent,
                newContent: content
            }],
            stats: { additions: 1, deletions: 0 }
        });

        await newCommit.save();
        
        const branchIdx = repo.branches.findIndex(b => b.name === branch);
        if (branchIdx >= 0) {
            repo.branches[branchIdx].headCommit = newCommit._id;
        } else {
             repo.branches.push({ name: branch, headCommit: newCommit._id });
        }
        await repo.save();

        res.status(201).json(existingFile);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Diff Viewer
exports.getDiff = async (req, res) => {
    try {
        const { repoId } = req.query;
        const { base, head } = req.query; 

        const baseFiles = await File.find({ repoId, branch: base });
        const headFiles = await File.find({ repoId, branch: head });

        const fileMap = {}; 

        baseFiles.forEach(f => {
            if (!fileMap[f.filePath]) fileMap[f.filePath] = {};
            fileMap[f.filePath].base = f;
        });

        headFiles.forEach(f => {
            if (!fileMap[f.filePath]) fileMap[f.filePath] = {};
            fileMap[f.filePath].head = f;
        });

        const diffs = [];

        Object.keys(fileMap).forEach(path => {
            const entry = fileMap[path];
            const baseContent = entry.base ? entry.base.content : '';
            const headContent = entry.head ? entry.head.content : '';

            if (baseContent !== headContent) {
                const patch = Diff.createTwoFilesPatch(
                    path, path, baseContent, headContent
                );
                diffs.push({
                    filePath: path,
                    patch,
                    status: !entry.base ? 'added' : (!entry.head ? 'deleted' : 'modified')
                });
            }
        });

        res.json(diffs);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Code Comments
exports.addComment = async (req, res) => {
    try {
        const { fileId, line, content } = req.body;
        const comment = new CodeComment({
            fileId,
            line,
            userId: req.user.id,
            content
        });
        await comment.save();
        await comment.populate('userId', 'name avatar');
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getComments = async (req, res) => {
    try {
        const { fileId } = req.params;
        const comments = await CodeComment.find({ fileId })
            .populate('userId', 'name avatar')
            .sort({ createdAt: 1 });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
