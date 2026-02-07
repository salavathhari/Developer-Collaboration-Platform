import api from "./api";

export const summarizeChat = async (
  projectId: string,
  payload: { limit?: number; store?: boolean }
) => {
  const response = await api.post<{ summary: string; summaryId: string | null }>(
    `/api/projects/${projectId}/summaries`,
    payload
  );
  return response.data;
};
