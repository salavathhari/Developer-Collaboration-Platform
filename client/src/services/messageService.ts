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

// New collaboration chat functions

export const getChatHistory = async (
  projectId: string,
  roomType: string,
  roomId: string,
  limit = 50,
  before?: string
) => {
  const response = await api.get(`/api/chat/history`, {
    params: { projectId, roomType, roomId, limit, before },
  });
  return response.data;
};

export const sendChatMessage = async (
  projectId: string,
  roomType: string,
  roomId: string,
  text: string,
  replyTo?: string
) => {
  const response = await api.post(`/api/chat/send`, {
    projectId,
    roomType,
    roomId,
    text,
    replyTo,
  });
  return response.data;
};

export const markMessagesAsRead = async (
  projectId: string,
  roomType: string,
  roomId: string,
  messageIds: string[]
) => {
  const response = await api.post(`/api/chat/read`, {
    projectId,
    roomType,
    roomId,
    messageIds,
  });
  return response.data;
};

export const editChatMessage = async (messageId: string, content: string) => {
  const response = await api.put(`/api/chat/${messageId}`, { content });
  return response.data;
};

export const deleteChatMessage = async (messageId: string) => {
  const response = await api.delete(`/api/chat/${messageId}`);
  return response.data;
};
