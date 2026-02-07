import api from "./api";

export const queryAi = async (payload: {
  prompt: string;
  projectId?: string | null;
  provider?: "openai" | "gemini" | "local";
}) => {
  const response = await api.post<{ response: string; logId: string }>(
    "/api/ai/query",
    payload
  );
  return response.data;
};
