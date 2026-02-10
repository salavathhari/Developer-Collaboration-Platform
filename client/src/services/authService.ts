import api from "./api";
import type { User } from "../types";

export type AuthResponse = {
  success: boolean;
  accessToken: string;
  expiresIn: string;
  user: User;
};

export type RefreshResponse = {
  success: boolean;
  accessToken: string;
  expiresIn: string;
};

export type LoginPayload = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type SignupPayload = {
  name: string;
  email: string;
  password: string;
};

export type ProfileUpdatePayload = {
  name?: string;
  email?: string;
  bio?: string;
};

export const login = async (
  email: string,
  password: string,
  rememberMe: boolean = false
) => {
  const response = await api.post<AuthResponse>("/api/auth/login", {
    email,
    password,
    rememberMe,
  });
  return response.data;
};

export const register = async (payload: SignupPayload) => {
  const response = await api.post<{ success: boolean; message: string; user: { id: string; name: string; email: string } }>(
    "/api/auth/register",
    payload
  );
  return response.data;
};

export const refreshAccessToken = async () => {
  const response = await api.post<RefreshResponse>("/api/auth/refresh", {});
  return response.data;
};

export const logout = async () => {
  await api.post("/api/auth/logout", {});
};

export const getProfile = async () => {
  const response = await api.get<{ user: User }>("/api/users/me");
  return response.data.user;
};

export const updateProfile = async (payload: ProfileUpdatePayload) => {
  const response = await api.put<{ user: User }>("/api/users/me", payload);
  return response.data.user;
};

export const uploadAvatar = async (file: File) => {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await api.post<{ user: User }>(
    "/api/users/me/avatar",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );

  return response.data.user;
};
