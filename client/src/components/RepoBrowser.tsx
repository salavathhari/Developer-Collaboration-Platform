import { useEffect, useState } from "react";
import { createRepository, getRepository, getRepoFiles, getCommits, commitChanges } from "../services/repoService";
import type { Repository, Commit, FileNode } from "../types";
import type { Project } from "../types";
import { formatDistanceToNow } from "date-fns";

const FileIcon = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const FolderIcon = () => (
    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M2 6a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
);

const RepoBrowser = ({ project }: { project: Project }) => {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [latestCommit, setLatestCommit] = useState<Commit | null>(null);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [showBranchMenu, setShowBranchMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddMenu, setShowAddMenu] = useState(false);

  const loadRepo = async () => {
      try {
          const data = await getRepository(project._id);
          setRepo(data);
          if (data.defaultBranch) setCurrentBranch(data.defaultBranch);
          loadFiles(data._id, data.defaultBranch);
          loadLatestCommit(data._id, data.defaultBranch);
      } catch (e) {
          setRepo(null);
      } finally {
          setLoading(false);
      }
  };

  const loadFiles = async (repoId: string, branchName?: string) => {
      try {
          const data = await getRepoFiles(repoId, branchName || currentBranch);
          if (Array.isArray(data)) {
            // Sort: folders first, then files, alphabetically
            const sorted = data.sort((a, b) => {
                if (a.type === 'folder' && b.type !== 'folder') return -1;
                if (a.type !== 'folder' && b.type === 'folder') return 1;
                return a.path.localeCompare(b.path);
            });
            setFiles(sorted);
          }
      } catch(e) { 
          console.error(e); 
      }
  };
  
  const loadLatestCommit = async (repoId: string, branchName: string) => {
      try {
          const commits = await getCommits(repoId, branchName);
          if (commits && commits.length > 0) {
              setLatestCommit(commits[0]);
          }
      } catch(e) { 
          console.error(e); 
      }
  };

  useEffect(() => {
      loadRepo();
  }, [project._id]);

  useEffect(() => {
      if (repo) {
          loadFiles(repo._id, currentBranch);
          loadLatestCommit(repo._id, currentBranch);
      }
  }, [currentBranch]);

  const handleBranchSwitch = (branchName: string) => {
      setCurrentBranch(branchName);
      setShowBranchMenu(false);
      setSelectedFile(null);
  };

  const handleCreateRepo = async () => {
      try {
          const newRepo = await createRepository(project._id, project.name.toLowerCase().replace(/\s+/g, '-'));
          setRepo(newRepo);
          loadFiles(newRepo._id);
      } catch(e: any) {
          alert(e.response?.data?.message || "Failed to create repo");
      }
  };

  const handleFileClick = async (file: FileNode) => {
      if (file.type === 'folder') {
          // In a real implementation, navigate into folder
          return;
      }
      
      if (!repo) return;
      try {
          const detail = await getRepoFiles(repo._id, undefined, file.path) as FileNode;
          setSelectedFile(detail);
      } catch(e) {
          console.error(e);
      }
  };

  const filteredFiles = files.filter(f => 
      f.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-10 text-center text-gray-500">Loading Repository...</div>;

  if (!repo) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-[#0d1117]">
              <div className="bg-[#161b22] p-8 rounded-xl border border-gray-700 max-w-md">
                 <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                     <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                     </svg>
                 </div>
                 <h2 className="text-xl font-bold mb-2 text-white">No Repository Found</h2>
                 <p className="text-gray-400 mb-6 text-sm">Initialize a code repository to start collaborating on code, managing versions, and creating pull requests.</p>
                 <button 
                    onClick={handleCreateRepo}
                    className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold w-full transition-colors"
                 >
                     Initialize Repository
                 </button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-white">
        {/* GitHub-style Top Bar */}
        <div className="bg-[#161b22] border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    {/* Branch Selector */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowBranchMenu(!showBranchMenu)}
                            className="flex items-center gap-2 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            {currentBranch}
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showBranchMenu && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-[#161b22] border border-gray-700 rounded-md shadow-2xl z-20 overflow-hidden">
                                <div className="px-4 py-2 bg-[#0d1117] border-b border-gray-700 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-300">Switch branches/tags</span>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    <div className="px-3 py-1.5 text-xs text-gray-500 font-semibold">BRANCHES</div>
                                    {repo.branches?.map((b: any) => (
                                        <button 
                                            key={b.name}
                                            onClick={() => handleBranchSwitch(b.name)}
                                            className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1f6feb] hover:text-white transition-colors ${
                                                currentBranch === b.name ? 'bg-[#1f6feb]/20 text-[#58a6ff] font-semibold' : 'text-gray-300'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {b.name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Branch/Tag Count */}
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <strong>{repo.branches?.length || 1}</strong> Branch{repo.branches?.length !== 1 ? 'es' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <strong>0</strong> Tags
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Go to file search */}
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Go to file"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#0d1117] border border-gray-600 text-white text-sm px-3 py-1.5 rounded-md w-64 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#21262d] text-gray-400 text-xs px-1.5 py-0.5 rounded border border-gray-600">
                            t
                        </kbd>
                    </div>

                    {/* Add file dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="flex items-center gap-2 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                        >
                            Add file
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showAddMenu && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-[#161b22] border border-gray-700 rounded-md shadow-2xl z-20 overflow-hidden">
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#1f6feb] hover:text-white transition-colors">
                                    Create new file
                                </button>
                                <button className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#1f6feb] hover:text-white transition-colors">
                                    Upload files
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Code button */}
                    <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        Code
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Latest Commit Banner */}
            {latestCommit && (
                <div className="flex items-center justify-between bg-[#0d1117] border border-gray-700 rounded-md px-4 py-2 text-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {latestCommit.author?.name?.substring(0, 2).toUpperCase() || 'UN'}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[#58a6ff] font-semibold hover:underline cursor-pointer">
                                {latestCommit.author?.name || 'Unknown'}
                            </span>
                            <span className="text-gray-300">{latestCommit.message}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-gray-400">
                        <a href="#" className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                            <span className="font-mono text-xs">{latestCommit._id.substring(0, 7)}</span>
                        </a>
                        <span>·</span>
                        <span>{formatDistanceToNow(new Date(latestCommit.createdAt))} ago</span>
                        <span>·</span>
                        <a href="#" className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <strong>{(repo as any).commits?.length || 1}</strong> Commits
                        </a>
                    </div>
                </div>
            )}
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto">
            {selectedFile ? (
                // File viewer
                <div className="bg-[#0d1117]">
                    <div className="border-b border-gray-700 px-6 py-3 bg-[#161b22] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setSelectedFile(null)}
                                className="text-gray-400 hover:text-white"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <span className="text-gray-300 font-mono text-sm">{selectedFile.path}</span>
                        </div>
                        <button className="text-gray-400 hover:text-white text-sm flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Edit file
                        </button>
                    </div>
                    <div className="px-6 py-4">
                        <pre className="bg-[#161b22] border border-gray-700 rounded-md p-4 text-gray-300 font-mono text-sm overflow-x-auto">
                            <code>{selectedFile.content || 'No content available'}</code>
                        </pre>
                    </div>
                </div>
            ) : (
                // File list table
                <div className="border border-gray-700 rounded-md mx-6 my-4 overflow-hidden">
                    {filteredFiles.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p>No files found</p>
                        </div>
                    ) : (
                        filteredFiles.map((file, idx) => (
                            <div 
                                key={file.path}
                                onClick={() => handleFileClick(file)}
                                className={`flex items-center justify-between px-4 py-3 hover:bg-[#161b22] cursor-pointer transition-colors group ${
                                    idx !== 0 ? 'border-t border-gray-800' : ''
                                }`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    {file.type === 'folder' ? <FolderIcon /> : <FileIcon />}
                                    <span className="text-[#58a6ff] text-sm font-medium group-hover:underline truncate">
                                        {file.path}
                                    </span>
                                </div>
                                <div className="flex items-center gap-8 text-sm text-gray-400 ml-4">
                                    <span className="truncate max-w-xs">
                                        {(file as any).lastCommitMessage || 'Initial commit'}
                                    </span>
                                    <span className="whitespace-nowrap">
                                        {(file as any).lastModified ? formatDistanceToNow(new Date((file as any).lastModified)) + ' ago' : '5 months ago'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* README Preview (if not viewing a file) */}
            {!selectedFile && files.some(f => f.path.toLowerCase() === 'readme.md') && (
                <div className="mx-6 mb-6">
                    <div className="border border-gray-700 rounded-md overflow-hidden">
                        <div className="bg-[#161b22] px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-white font-semibold text-sm">README</span>
                            </div>
                            <span className="text-sm text-gray-400">📖</span>
                        </div>
                        <div className="bg-[#0d1117] px-6 py-4 text-gray-300 text-sm leading-relaxed">
                            <h1 className="text-2xl font-bold mb-4 text-white">{repo.name}</h1>
                            <p className="text-gray-400">Welcome to the repository. Add a README.md file to provide more information about your project.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default RepoBrowser;
