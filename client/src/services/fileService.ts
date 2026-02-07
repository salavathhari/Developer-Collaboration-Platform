import api from "./api";
import type { FileAsset } from "../types";

export const uploadFile = async (projectId: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<{ file: FileAsset }>(
    `/api/projects/${projectId}/files/upload`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    }
  );

  return response.data.file;
};

export const getSignedUrl = async (
  projectId: string,
  payload: { filename: string; contentType: string }
) => {
  const response = await api.post<{ url: string; key: string }>(
    `/api/projects/${projectId}/files/signed-url`,
    payload
  );
  return response.data;
};
