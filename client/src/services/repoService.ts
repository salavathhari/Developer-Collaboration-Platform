import api from "./api";
import type { Repository, Commit, FileNode } from "../types";

export const createRepository = async (projectId: string, name: string, description?: string) => {
  const response = await api.post<Repository>("/api/repos/create", { projectId, name, description });
  return response.data;
};

export const getRepository = async (projectId: string) => {
  const response = await api.get<Repository>(`/api/repos/project/${projectId}`);
  return response.data;
};

export const getCommits = async (repoId: string, branch?: string) => {
    const response = await api.get<Commit[]>(`/api/repos/${repoId}/commits`, { params: { branch } });
    return response.data;
};

export const getRepoFiles = async (repoId: string, branch?: string, path?: string) => {
    const response = await api.get<FileNode[] | FileNode>(`/api/repos/${repoId}/files`, { params: { branch, path }});
    return response.data;
};

export const commitChanges = async (repoId: string, message: string, branchName: string, files: { path: string, content: string | null }[]) => {
    const response = await api.post<Commit>(`/api/repos/${repoId}/commit`, { message, branchName, files });
    return response.data;
};
