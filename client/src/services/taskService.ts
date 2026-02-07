import api from "./api";
import type { Task } from "../types";

export const getTasks = async (projectId: string) => {
  const response = await api.get<{ tasks: Task[] }>(
    `/api/projects/${projectId}/tasks`
  );
  return response.data.tasks;
};

export const createTask = async (projectId: string, payload: Partial<Task>) => {
  const response = await api.post<{ task: Task }>(
    `/api/projects/${projectId}/tasks`,
    payload
  );
  return response.data.task;
};

export const updateTask = async (
  projectId: string,
  taskId: string,
  payload: Partial<Task>
) => {
  const response = await api.patch<{ task: Task }>(
    `/api/projects/${projectId}/tasks/${taskId}`,
    payload
  );
  return response.data.task;
};

export const deleteTask = async (projectId: string, taskId: string) => {
  const response = await api.delete<{ success: boolean }>(
    `/api/projects/${projectId}/tasks/${taskId}`
  );
  return response.data.success;
};

export const addComment = async (
  projectId: string,
  taskId: string,
  content: string
) => {
  const response = await api.post<{ task: Task }>(
    `/api/projects/${projectId}/tasks/${taskId}/comments`,
    { content }
  );
  return response.data.task;
};
