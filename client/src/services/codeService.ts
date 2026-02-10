import api from './api';

export const codeService = {
  getRepo: (projectId: string) => api.get(`/api/code/repos/${projectId}`),
  getFiles: (repoId: string, branch = 'main') => api.get(`/api/code/files/${repoId}?branch=${branch}`),
  getFileContent: (fileId: string) => api.get(`/api/code/file/${fileId}`),
  commitChanges: (repoId: string, message: string, files: any[], branch = 'main') => 
    api.post('/api/code/commit', { repoId, message, files, branch }),
  getDiff: (repoId: string, base: string, head: string) => 
    api.get(`/api/code/diff?repoId=${repoId}&base=${base}&head=${head}`),
  
  // Creation (uses repoController routes)
  createRepo: (projectId: string, name: string, description?: string) =>
    api.post('/api/repos/create', { projectId, name, description }),

  // Comments
  addComment: (fileId: string, line: number, content: string) => 
    api.post('/api/code/comment', { fileId, line, content }),
  getComments: (fileId: string) => api.get(`/api/code/comments/${fileId}`),
  
  // Upload
  uploadFile: (repoId: string, branch: string, file: File, filePath?: string) => {
      const formData = new FormData();
      formData.append('repoId', repoId);
      formData.append('branch', branch);
      formData.append('file', file);
      if(filePath) formData.append('filePath', filePath);
      
      return api.post('/api/code/upload', formData, {
          headers: {
              'Content-Type': 'multipart/form-data'
          }
      });
  }
};
