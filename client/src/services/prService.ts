import api from "./api";

export interface PullRequest {
    _id: string;
    number?: number; // PR number (auto-incremented per project)
    title: string;
    description: string;
    projectId: string;
    author: { _id: string; name?: string; username?: string; email: string };
    status: "open" | "blocked" | "approved" | "merged" | "closed";
    baseBranch: string;
    headBranch: string;
    reviewers: Array<{ _id: string; name?: string; username?: string }>;
    approvals: Array<{ userId: string; approvedAt: string }> | Array<string>; // Can be either format
    filesChanged: DiffFile[];
    conflicts?: string[]; // Merge conflict files
    mergeCommitHash?: string;
    mergedBy?: { _id: string; name?: string; username?: string };
    mergedAt?: string;
    commits?: Array<{ hash: string; message: string; author: string; email: string; date: string }>;
    createdAt: string;
    updatedAt?: string;
}

export interface Comment {
    _id: string;
    pullRequestId: string;
    author: { _id: string; name: string };
    filePath: string;
    lineNumber: number;
    content: string;
    createdAt: string;
}

export interface DiffFile {
    file?: string;
    path?: string;
    additions: number;
    deletions: number;
    status: string;
    diffSnippet?: string;
}

export interface DiffResult {
    rawDiff: string;
    files: DiffFile[];
}

export const getPullRequestDiff = async (id: string) => {
    const response = await api.get<DiffResult>(`/api/pull-requests/${id}/diff`);
    return response.data;
};

export const getPullRequestFile = async (id: string, filePath: string) => {
    const response = await api.get<{ baseContent: string; headContent: string }>(`/api/pull-requests/${id}/file?filePath=${filePath}`);
    return response.data;
};

export const getPullRequests = async (projectId: string) => {
  const response = await api.get<{ success: boolean; prs: PullRequest[]; count: number }>(`/api/pull-requests?projectId=${projectId}`);
  return response.data.prs; // Extract prs array from response
};

export const getPullRequestById = async (id: string) => {
    const response = await api.get<{ success: boolean; pr: PullRequest; linkedTasks?: any[] }>(
        `/api/pull-requests/${id}`
    );
    return response.data; // return pr + linkedTasks
};

export const createPullRequest = async (projectId: string, data: any) => {
  const response = await api.post<{ success: boolean; pr: PullRequest }>(`/api/pull-requests`, { ...data, projectId });
  return response.data.pr; // Extract pr from response
};

export const updatePullRequest = async (id: string, updates: any) => {
  const response = await api.put<{ success: boolean; pr: PullRequest }>(`/api/pull-requests/${id}`, updates);
  return response.data.pr; // Extract pr from response
};

export const mergePullRequest = async (id: string) => {
    const response = await api.post<{ success: boolean; pr: PullRequest }>(`/api/pull-requests/${id}/merge`);
    return response.data.pr; // Extract pr from response
};

export const approvePullRequest = async (id: string) => {
    const response = await api.post<{ success: boolean; pr: PullRequest }>(`/api/pull-requests/${id}/approve`);
    return response.data.pr; // Extract pr from response
};

export const rejectPullRequest = async (id: string) => {
    const response = await api.put<{ success: boolean; pr: PullRequest }>(`/api/pull-requests/${id}/reject`);
    return response.data.pr; // Extract pr from response
};

export const getComments = async (id: string) => {
    const response = await api.get<Comment[]>(`/api/pull-requests/${id}/comments`);
    return response.data;
};

export const createComment = async (id: string, data: { filePath: string; lineNumber: number; content: string }) => {
    const response = await api.post<Comment>(`/api/pull-requests/${id}/comments`, data);
    return response.data;
};

export interface Commit {
    hash: string;
    author: string;
    email: string;
    timestamp: number;
    message: string;
}

export const getCommitHistory = async (id: string) => {
    const response = await api.get<Commit[]>(`/api/pull-requests/${id}/commits`);
    return response.data;
};

export const getBranches = async (projectId: string) => {
    const response = await api.get<string[]>(`/api/pull-requests/branches/list?projectId=${projectId}`);
    return response.data;
};

export const createBranch = async (projectId: string, branchName: string, fromBranch?: string) => {
    const response = await api.post(`/api/pull-requests/branches/create`, { projectId, branchName, fromBranch });
    return response.data;
};
