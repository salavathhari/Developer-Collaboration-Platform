import api from "./api";
import type { Notification } from "../types";

export const getNotifications = async () => {
  const response = await api.get<{ notifications: Notification[]; unreadCount: number }>(
    "/api/notifications"
  );
  return response.data;
};

export const markNotificationRead = async (id: string) => {
  const response = await api.patch<{ notification: Notification }>(
    `/api/notifications/${id}/read`
  );
  return response.data.notification;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch<{ success: boolean }>(
    "/api/notifications/read-all"
  );
  return response.data;
};
