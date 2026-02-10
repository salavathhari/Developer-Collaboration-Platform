import api from "./api";

export interface Attachment {
  _id: string;
  name: string;
  projectId: string;
  uploadedBy: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  url: string;
  storageKey: string;
  size: number;
  mimeType: string;
  relatedTask?: string | null;
  relatedPR?: string | null;
  relatedChatMessage?: string | null;
  version: number;
  visibility: "project" | "private";
  meta: any;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string;
}

export interface UploadFileParams {
  file: File;
  projectId: string;
  relatedTask?: string;
  relatedPR?: string;
  relatedChatMessage?: string;
  visibility?: "project" | "private";
}

export interface GetFilesParams {
  projectId: string;
  context?: "task" | "pr" | "chat";
  contextId?: string;
}

/**
 * Upload a file
 */
export const uploadFile = async (params: UploadFileParams): Promise<Attachment> => {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("projectId", params.projectId);
  
  if (params.relatedTask) formData.append("relatedTask", params.relatedTask);
  if (params.relatedPR) formData.append("relatedPR", params.relatedPR);
  if (params.relatedChatMessage) formData.append("relatedChatMessage", params.relatedChatMessage);
  if (params.visibility) formData.append("visibility", params.visibility);

  const response = await api.post("/attachments/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data.attachment;
};

/**
 * Get files for a project (optionally filtered by context)
 */
export const getProjectFiles = async (params: GetFilesParams): Promise<Attachment[]> => {
  const queryParams = new URLSearchParams();
  if (params.context) queryParams.append("context", params.context);
  if (params.contextId) queryParams.append("contextId", params.contextId);

  const response = await api.get(
    `/attachments/project/${params.projectId}?${queryParams.toString()}`
  );

  return response.data.attachments;
};

/**
 * Get single file with signed URL
 */
export const getFile = async (fileId: string): Promise<Attachment> => {
  const response = await api.get(`/attachments/${fileId}`);
  return response.data.attachment;
};

/**
 * Delete a file
 */
export const deleteFile = async (fileId: string): Promise<void> => {
  await api.delete(`/attachments/${fileId}`);
};

/**
 * Update file links
 */
export const updateFileLinks = async (
  fileId: string,
  links: {
    relatedTask?: string;
    relatedPR?: string;
    relatedChatMessage?: string;
  }
): Promise<Attachment> => {
  const response = await api.put(`/attachments/${fileId}/link`, links);
  return response.data.attachment;
};

/**
 * Replace file content
 */
export const replaceFile = async (fileId: string, file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post(`/attachments/${fileId}/replace`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data.attachment;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};

/**
 * Get file icon based on mime type
 */
export const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎥";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word")) return "📝";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "📊";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "📽️";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) return "📦";
  if (mimeType.startsWith("text/")) return "📃";
  return "📎";
};

/**
 * Check if file is previewable
 */
export const isPreviewable = (mimeType: string): boolean => {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  );
};
