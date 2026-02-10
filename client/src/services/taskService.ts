import api from "./api";
import type { Task } from "../types";

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "critical";
  status?: "todo" | "in_progress" | "review" | "done" | "blocked";
  assignees?: string[];
  dueDate?: string;
  labels?: string[];
  estimatedHours?: number;
  linkedPRs?: string[];
  linkedFiles?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: "todo" | "in_progress" | "review" | "done" | "blocked";
  priority?: "low" | "medium" | "high" | "critical";
  assignees?: string[];
  dueDate?: string;
  labels?: string[];
  estimatedHours?: number;
  isBlocked?: boolean;
  blockerReason?: string;
}

export interface MoveTaskPayload {
  toStatus: "todo" | "in_progress" | "review" | "done" | "blocked";
  toOrderKey: number;
  fromStatus?: string;
}

export interface LinkPRPayload {
  prId: string;
}

export interface LinkFilePayload {
  fileId: string;
}

export interface BulkUpdatePayload {
  taskIds: string[];
  updates: {
    status?: string;
    priority?: string;
    assignees?: string[];
    labels?: string[];
  };
}

export const taskService = {
  // Fetch all tasks for a project with optional filters
  getTasks: async (
    projectId: string,
    params?: {
      status?: string;
      priority?: string;
      assignees?: string;
      labels?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) => {
    const response = await api.get<{ success: boolean; tasks: Task[]; total: number; page: number; totalPages: number }>(
      `/api/projects/${projectId}/tasks`,
      { params }
    );
    return response.data;
  },

  // Get analytics for project tasks
  getAnalytics: async (projectId: string) => {
    const response = await api.get<{
      success: boolean;
      metrics: {
        total: number;
        completed: number;
        completionRate: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
        avgCompletionTime: number;
      };
    }>(`/api/projects/${projectId}/tasks/analytics`);
    return response.data;
  },

  // Create a new task
  createTask: async (projectId: string, payload: CreateTaskPayload) => {
    const response = await api.post<{ success: boolean; task: Task }>(
      `/api/projects/${projectId}/tasks`,
      payload
    );
    return response.data;
  },

  // Update an existing task
  updateTask: async (projectId: string, taskId: string, payload: UpdateTaskPayload) => {
    const response = await api.put<{ success: boolean; task: Task; changedFields: string[] }>(
      `/api/projects/${projectId}/tasks/${taskId}`,
      payload
    );
    return response.data;
  },

  // Delete a task
  deleteTask: async (projectId: string, taskId: string) => {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/api/projects/${projectId}/tasks/${taskId}`
    );
    return response.data;
  },

  // Move task to different column (drag & drop)
  moveTask: async (projectId: string, taskId: string, payload: MoveTaskPayload) => {
    const response = await api.post<{ success: boolean; task: Task }>(
      `/api/projects/${projectId}/tasks/${taskId}/move`,
      payload
    );
    return response.data;
  },

  // Link a pull request to a task
  linkPR: async (projectId: string, taskId: string, payload: LinkPRPayload) => {
    const response = await api.post<{ success: boolean; task: Task; message: string }>(
      `/api/projects/${projectId}/tasks/${taskId}/link-pr`,
      payload
    );
    return response.data;
  },

  // Link a file to a task
  linkFile: async (projectId: string, taskId: string, payload: LinkFilePayload) => {
    const response = await api.post<{ success: boolean; task: Task; message: string }>(
      `/api/projects/${projectId}/tasks/${taskId}/link-file`,
      payload
    );
    return response.data;
  },

  // Bulk update multiple tasks
  bulkUpdateTasks: async (projectId: string, payload: BulkUpdatePayload) => {
    const response = await api.post<{
      success: boolean;
      results: Array<{ taskId: string; success: boolean; error?: string }>;
      successCount: number;
      failureCount: number;
    }>(`/api/projects/${projectId}/tasks/bulk-update`, payload);
    return response.data;
  },

  // Add a comment to a task
  addComment: async (projectId: string, taskId: string, text: string) => {
    const response = await api.post<{ success: boolean; comment: any; task: Task }>(
      `/api/projects/${projectId}/tasks/${taskId}/comments`,
      { text }
    );
    return response.data;
  },

  // Upload an attachment to a task
  uploadAttachment: async (projectId: string, taskId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<{ success: boolean; task: Task; attachment: any }>(
      `/api/projects/${projectId}/tasks/${taskId}/attachments`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  },
};
