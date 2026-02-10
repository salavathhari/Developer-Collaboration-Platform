import api from './api';

export interface RepoFile {
    name: string;
    type: 'file' | 'folder';
    path: string;
    mode?: string;
    hash?: string;
}

export interface Commit {
    hash: string;
    author: string;
    timeAgo: string;
    message: string;
}

export interface RepoStats {
    commitCount: number;
    contributorCount: number;
    fileCount: number;
}

export interface LatestCommit {
    hash: string;
    author: string;
    timeAgo: string;
    message: string;
}

/**
 * Initialize Git repository for project
 */
export const initRepository = async (projectId: string) => {
    const response = await api.post('/api/repos/init', { projectId });
    return response.data;
};

/**
 * List files in repository
 */
export const listFiles = async (projectId: string, branch: string = 'main', path: string = '') => {
    const response = await api.get<{ files: RepoFile[] }>(
        `/api/repos/${projectId}/files`,
        { params: { branch, path } }
    );
    return response.data.files;
};

/**
 * Get file content
 */
export const getFileContent = async (projectId: string, path: string, branch: string = 'main') => {
    const response = await api.get<{ content: string; path: string; branch: string }>(
        `/api/repos/${projectId}/file-content`,
        { params: { path, branch } }
    );
    return response.data;
};

/**
 * Get commit history
 */
export const getCommitHistory = async (projectId: string, branch: string = 'main', limit: number = 50) => {
    const response = await api.get<{ commits: Commit[] }>(
        `/api/repos/${projectId}/commits`,
        { params: { branch, limit } }
    );
    return response.data.commits;
};

/**
 * Upload file to repository
 */
export const uploadFile = async (
    projectId: string,
    filePath: string,
    content: string,
    branch: string = 'main',
    message?: string
) => {
    const response = await api.post(`/api/repos/${projectId}/upload`, {
        path: filePath,
        content,
        branch,
        message: message || `Add ${filePath}`
    });
    return response.data;
};

/**
 * Get repository statistics
 */
export const getRepoStats = async (projectId: string, branch: string = 'main') => {
    const response = await api.get<RepoStats>(
        `/api/repos/${projectId}/stats`,
        { params: { branch } }
    );
    return response.data;
};

/**
 * Get latest commit
 */
export const getLatestCommit = async (projectId: string, branch: string = 'main') => {
    const response = await api.get<LatestCommit>(
        `/api/repos/${projectId}/latest-commit`,
        { params: { branch } }
    );
    return response.data;
};

/**
 * List available branches
 */
export const listBranches = async (projectId: string) => {
    const response = await api.get<{ branches: string[] }>(
        `/api/repos/${projectId}/branches`
    );
    return response.data.branches;
};

/**
 * Create a new branch
 */
export const createBranch = async (projectId: string, branchName: string, fromBranch: string = 'main') => {
    const response = await api.post(`/api/repos/${projectId}/branch`, {
        branchName,
        fromBranch
    });
    return response.data;
};

/**
 * Upload multiple files to repository
 */
export const uploadFiles = async (
    projectId: string,
    files: Array<{ path: string; content: string }>,
    branch: string = 'main',
    commitMessage: string,
    commitDescription?: string,
    author?: { name: string; email: string }
) => {
    const response = await api.post(`/api/repos/${projectId}/upload-multiple`, {
        files,
        branch,
        message: commitMessage,
        description: commitDescription,
        author
    });
    return response.data;
};
