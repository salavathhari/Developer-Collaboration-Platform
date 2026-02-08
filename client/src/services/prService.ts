import api from "./api";

export interface PullRequest {
    _id: string;
    title: string;
    description: string;
    projectId: string;
    author: { _id: string; name: string; email: string };
    status: "open" | "merged" | "closed";
    baseBranch: string;
    headBranch: string;
    reviewers: Array<{ _id: string; name: string }>;
    createdAt: string;
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

export const getPullRequests = async (projectId: string) => {
  const response = await api.get<PullRequest[]>(`/api/pull-requests?projectId=${projectId}`);
  return response.data;
};

export const getPullRequestById = async (id: string) => {
  const response = await api.get<PullRequest>(`/api/pull-requests/${id}`);
  return response.data;
};

export const createPullRequest = async (projectId: string, data: any) => {
  const response = await api.post<PullRequest>(`/api/pull-requests`, { ...data, projectId });
  return response.data;
};

export const updatePullRequest = async (id: string, updates: any) => {
  const response = await api.put<PullRequest>(`/api/pull-requests/${id}`, updates);
  return response.data;
};

export const mergePullRequest = async (id: string) => {
    const response = await api.put<PullRequest>(`/api/pull-requests/${id}/merge`);
    return response.data;
};

export const getComments = async (id: string) => {
    const response = await api.get<Comment[]>(`/api/pull-requests/${id}/comments`);
    return response.data;
};

export const createComment = async (id: string, data: { filePath: string; lineNumber: number; content: string }) => {
    const response = await api.post<Comment>(`/api/pull-requests/${id}/comments`, data);
    return response.data;
};
