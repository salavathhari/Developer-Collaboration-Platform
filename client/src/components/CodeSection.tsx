import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { codeService } from '../services/codeService';
import FileTree from './FileTree';
import CodeViewer from './CodeViewer';
import { GitBranch, FolderOpen, Code, Plus, Upload } from 'lucide-react';
import { queryAi } from '../services/aiService';

const CodeSection: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [repo, setRepo] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loading, setLoading] = useState(true);
  const [explainLoading, setExplainLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiProvider, setAiProvider] = useState<'openai' | 'local'>('openai');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectId) {
      loadRepo();
    }
  }, [projectId]);

  const loadRepo = async () => {
    try {
      setLoading(true);
      const { data } = await codeService.getRepo(projectId!);
      setRepo(data);
      if (data) {
          loadFiles(data._id, selectedBranch);
      }
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
          // Repo doesn't exist yet, which is fine
          setRepo(null);
      } else {
          console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (repoId: string, branch: string) => {
      try {
          const { data } = await codeService.getFiles(repoId, branch);
          setFiles(data);
      } catch (error) {
          console.error(error);
      }
  };

  const handleCreateRepo = async () => {
     try {
         setLoading(true);
         await codeService.createRepo(projectId!, "Project Repo", "Main repository for project");
         await loadRepo(); // Reload to get the new repo
     } catch (error) {
         console.error("Failed to create repo", error);
         alert("Failed to initialize repository.");
         setLoading(false);
     }
  };

  const handleExplainCode = async () => {
      if (!currentFileId) return;
      setExplainLoading(true);
      try {
          // Fetch content first (assuming we have it in CodeViewer but getting it cleanly here)
          const { data: file } = await codeService.getFileContent(currentFileId);
          const prompt = `Please explain this code file (${file.fileName}):\n\n${file.content}`;
          
          const { response } = await queryAi({ prompt, projectId, provider: aiProvider });
          setAiExplanation(response || "No explanation returned.");
      } catch (error) {
          setAiExplanation("Failed to get explanation.");
      } finally {
          setExplainLoading(false);
      }
  };

  const handleUploadClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length || !repo) return;
      
      const file = e.target.files[0];
      setUploading(true);
      
      try {
          await codeService.uploadFile(repo._id, selectedBranch, file);
          await loadFiles(repo._id, selectedBranch);
          
      } catch (error) {
          console.error("Upload failed", error);
          alert("Failed to upload file");
      } finally {
          setUploading(false);
          if(fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  if (loading) return <div>Loading repository...</div>;
  if (!repo) return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white dark:bg-[#050505] dark:text-gray-400">
          <FolderOpen className="w-16 h-16 mb-4" />
          <h2 className="text-xl font-bold">No Repository Found</h2>
          <p className="mb-4">This project doesn't have a code repository yet.</p>
          <button 
            onClick={handleCreateRepo}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors"
          >
            Initialize Repository
          </button>
      </div>
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white dark:bg-[#050505]">
      
      {/* Sidebar - File Tree */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-[#0b0c10]">
        <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
           <div className="flex items-center font-semibold text-sm text-gray-700 dark:text-gray-200">
               <GitBranch className="w-4 h-4 mr-2" />
               <select 
                 className="bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 dark:text-gray-200"
                 value={selectedBranch}
                 onChange={(e) => {
                     setSelectedBranch(e.target.value);
                     loadFiles(repo._id, e.target.value);
                 }}
               >
                   {repo.branches?.map((b: any) => (
                       <option key={b.name} value={b.name} className="dark:bg-[#0b0c10]">{b.name}</option>
                   )) || <option value="main" className="dark:bg-[#0b0c10]">main</option>}
               </select>
           </div>
           
           <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange}
           />
           <button 
             onClick={handleUploadClick}
             disabled={uploading}
             className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400"
             title="Upload File"
           >
              <Upload className={`w-4 h-4 ${uploading ? 'animate-bounce' : ''}`} />
           </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
            <FileTree 
              files={files} 
              onSelect={setCurrentFileId} 
              selectedFileId={currentFileId} 
            />
        </div>
      </div>

      {/* Main Content - Code Viewer */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#050505]">
          {/* Toolbar */}
          <div className="h-10 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-gray-50 dark:bg-[#0b0c10]">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {currentFileId ? files.find(f => f._id === currentFileId)?.fileName : 'Select a file'}
              </span>
              <div className="flex items-center space-x-2">
                 {currentFileId && (
                   <>
                     <select 
                       value={aiProvider} 
                       onChange={(e) => setAiProvider(e.target.value as 'openai' | 'local')}
                       className="text-xs border-gray-300 dark:border-gray-700 rounded bg-transparent dark:bg-[#111] dark:text-gray-300 focus:ring-1 focus:ring-indigo-500 py-1"
                       title="Select AI Provider"
                     >
                        <option value="openai">Cloud AI</option>
                        <option value="local">Local (Ollama)</option>
                     </select>
                     <button 
                       onClick={handleExplainCode}
                       disabled={explainLoading}
                       className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 px-2 py-1 rounded flex items-center hover:bg-indigo-200 dark:hover:bg-indigo-500/30 border border-transparent dark:border-indigo-500/30 transition-colors"
                     >
                         <Code className="w-3 h-3 mr-1" />
                         {explainLoading ? 'Analyzing...' : 'Explain with AI'}
                     </button>
                   </>
                 )}
              </div>
          </div>

          <div className="flex-1 overflow-hidden relative bg-white dark:bg-[#050505]">
              {currentFileId ? (
                  <CodeViewer fileId={currentFileId} />
              ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600">
                      <div className="text-center">
                        <Code className="w-16 h-16 mb-4 mx-auto opacity-20" />
                        <p className="text-lg font-medium opacity-50">Select a file to view code</p>
                      </div>
                  </div>
              )}
          </div>
          
          {/* AI Explanation Panel */}
          {aiExplanation && (
              <div className="h-48 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10] p-4 overflow-y-auto shadow-inner absolute bottom-0 w-full z-30">
                  <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
                          <Code className="w-4 h-4 mr-2" /> AI Explanation
                      </h4>
                      <button 
                        onClick={() => setAiExplanation(null)}
                        className="text-gray-500 hover:text-red-500"
                      >
                          &times;
                      </button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap dark:text-gray-300">{aiExplanation}</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default CodeSection;
