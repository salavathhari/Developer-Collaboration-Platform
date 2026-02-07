import api from "./api";
import type { Message } from "../types";

export const getMessages = async (projectId: string, cursor?: string) => {
  const response = await api.get<{ messages: Message[]; nextCursor: string | null }>(
    `/api/projects/${projectId}/messages`,
    { params: { cursor } }
  );
  return response.data;
};

export const createMessage = async (
  projectId: string,
  payload: { content: string; attachments?: string[] }
) => {
  const response = await api.post<{ message: Message }>(
    `/api/projects/${projectId}/messages`,
    payload
  );
  return response.data.message;
};
