import api from "./api";
import type { Project } from "../types";

export type CreateProjectPayload = {
  name: string;
  description?: string;
};

export const getProjects = async () => {
  const response = await api.get<{ projects: Project[] }>("/api/projects");
  return response.data.projects;
};

export const getProject = async (projectId: string) => {
  const response = await api.get<{ project: Project }>(`/api/projects/${projectId}`);
  return response.data.project;
};

export const createProject = async (payload: CreateProjectPayload) => {
  const response = await api.post<{ project: Project }>("/api/projects", payload);
  return response.data.project;
};

export const inviteMember = async (projectId: string, email: string) => {
  const response = await api.post<{ inviteLink: string; expiresAt: string }>(
    `/api/projects/${projectId}/invite`,
    { email }
  );
  return response.data;
};

export const createInviteLink = async (projectId: string) => {
  const response = await api.post<{ inviteLink: string; expiresAt: string }>(
    `/api/projects/${projectId}/invite-link`
  );
  return response.data;
};

export const acceptInvite = async (token: string) => {
  const response = await api.post<{ project: Project }>(
    "/api/projects/invites/accept",
    { token }
  );
  return response.data.project;
};

export const deleteProject = async (projectId: string) => {
  const response = await api.delete<{ success: boolean; projectId: string }>(
    `/api/projects/${projectId}`
  );
  return response.data;
};
