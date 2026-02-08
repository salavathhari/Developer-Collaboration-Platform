import api from "./api";

export interface Column {
    _id: string;
    name: string;
    projectId: string;
    order: number;
}

export const getColumns = async (projectId: string) => {
  const response = await api.get<Column[]>(`/api/columns?projectId=${projectId}`);
  return response.data;
};

export const createColumn = async (projectId: string, name: string) => {
  const response = await api.post<Column>(`/api/columns`, { projectId, name });
  return response.data;
};

export const updateColumn = async (id: string, updates: Partial<Column>) => {
  const response = await api.put<Column>(`/api/columns/${id}`, updates);
  return response.data;
};

export const deleteColumn = async (id: string) => {
    const response = await api.delete(`/api/columns/${id}`);
    return response.data;
};
