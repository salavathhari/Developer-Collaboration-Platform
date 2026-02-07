import api from "./api";
import type { ProjectInsight } from "../types";

export const getLatestProjectInsight = async (projectId: string) => {
  const response = await api.get<{ insight: ProjectInsight | null }>(
    `/api/projects/${projectId}/insights/latest`
  );
  return response.data.insight;
};

export const generateProjectInsight = async (
  projectId: string,
  payload?: { windowDays?: number; provider?: string }
) => {
  const response = await api.post<{ insight: ProjectInsight }>(
    `/api/projects/${projectId}/insights/generate`,
    payload || {}
  );
  return response.data.insight;
};
