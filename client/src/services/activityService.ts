import api from "./api";
import type { Activity } from "../types";

export const getProjectActivity = async (projectId: string) => {
  const response = await api.get<{ activity: Activity[] }>(
    `/api/projects/${projectId}/activity`
  );
  return response.data.activity;
};
