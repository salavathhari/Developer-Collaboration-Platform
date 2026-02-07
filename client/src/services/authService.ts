import api from "./api";
import type { User } from "../types";

export type AuthResponse = {
  token: string;
  expiresIn: string;
  user: User;
};

export type LoginPayload = {
  email: string;
  password: string;
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

export const login = async (payload: LoginPayload) => {
  const response = await api.post<AuthResponse>("/api/auth/login", payload);
  return response.data;
};

export const register = async (payload: SignupPayload) => {
  const response = await api.post<AuthResponse>("/api/auth/register", payload);
  return response.data;
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
