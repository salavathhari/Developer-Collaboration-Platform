import { useEffect, useState } from 'react';
import { 
    listFiles, 
    getLatestCommit, 
    listBranches, 
    initRepository,
    getRepoStats,
    uploadFiles,
    createBranch,
    type RepoFile, 
    type LatestCommit,
    type RepoStats
} from '../services/gitRepoService';
import GitFileViewer from './GitFileViewer';
import GitCommitHistory from './GitCommitHistory';
import GitReadmePreview from './GitReadmePreview';
import { FolderIcon, FileIcon, GitBranch, Tag, Search, Upload, Code2, History, FileText, X } from 'lucide-react';

interface GitRepositoryBrowserProps {
    projectId: string;
}

const GitRepositoryBrowser: React.FC<GitRepositoryBrowserProps> = ({ projectId }) => {
    const [loading, setLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const [files, setFiles] = useState<RepoFile[]>([]);
    const [currentBranch, setCurrentBranch] = useState('main');
    const [branches, setBranches] = useState<string[]>(['main']);
    const [latestCommit, setLatestCommit] = useState<LatestCommit | null>(null);
    const [stats, setStats] = useState<RepoStats>({ commitCount: 0, contributorCount: 0, fileCount: 0 });
    const [currentPath, setCurrentPath] = useState('');
    const [selectedFile, setSelectedFile] = useState<RepoFile | null>(null);
    const [showBranchMenu, setShowBranchMenu] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'files' | 'commits'>('files');
    
    // Upload modal states
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFilesState, setUploadFilesState] = useState<File[]>([]);
    const [commitMessage, setCommitMessage] = useState('Add files via upload');
    const [commitDescription, setCommitDescription] = useState('');
    const [commitToBranch, setCommitToBranch] = useState<'direct' | 'new'>('direct');
    const [newBranchName, setNewBranchName] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    
    // Code dropdown state
    const [showCodeMenu, setShowCodeMenu] = useState(false);

    // Initialize repository
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                await initRepository(projectId);
                setInitialized(true);
                await loadRepositoryData();
            } catch (error) {
                console.error('Failed to initialize repository:', error);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [projectId]);

    // Load repository data
    const loadRepositoryData = async () => {
        try {
            const [filesData, branchesData, commitData, statsData] = await Promise.all([
                listFiles(projectId, currentBranch, currentPath),
                listBranches(projectId),
                getLatestCommit(projectId, currentBranch),
                getRepoStats(projectId, currentBranch)
            ]);
            
            setFiles(filesData);
            setBranches(branchesData);
            setLatestCommit(commitData);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load repository data:', error);
        }
    };

    // Reload when branch or path changes
    useEffect(() => {
        if (initialized) {
            loadRepositoryData();
        }
    }, [currentBranch, currentPath]);

    const handleFileClick = (file: RepoFile) => {
        if (file.type === 'folder') {
            setCurrentPath(file.path);
            setSelectedFile(null);
        } else {
            setSelectedFile(file);
        }
    };

    const handleBranchSwitch = (branch: string) => {
        setCurrentBranch(branch);
        setShowBranchMenu(false);
        setSelectedFile(null);
        setCurrentPath('');
    };

    const handleBackToRoot = () => {
        setCurrentPath('');
        setSelectedFile(null);
    };

    // File upload handlers
    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setUploadFilesState(Array.from(e.target.files));
            setUploadError(null);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files) {
            setUploadFilesState(Array.from(e.dataTransfer.files));
            setUploadError(null);
        }
    };

    const readFileAsText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    };

    const handleCommitChanges = async () => {
        if (uploadFilesState.length === 0) {
            setUploadError('Please select at least one file to upload');
            return;
        }

        if (!commitMessage.trim()) {
            setUploadError('Please provide a commit message');
            return;
        }

        setUploading(true);
        setUploadError(null);

        try {
            let targetBranch = currentBranch;
            
            // If creating a new branch, create it first
            if (commitToBranch === 'new') {
                if (!newBranchName.trim()) {
                    setUploadError('Please provide a branch name');
                    setUploading(false);
                    return;
                }
                
                // Validate branch name (GitHub-like rules)
                if (!/^[a-zA-Z0-9/_-]+$/.test(newBranchName)) {
                    setUploadError('Branch name can only contain letters, numbers, hyphens, underscores, and slashes');
                    setUploading(false);
                    return;
                }

                if (branches.includes(newBranchName)) {
                    setUploadError('Branch already exists');
                    setUploading(false);
                    return;
                }

                await createBranch(projectId, newBranchName, currentBranch);
                targetBranch = newBranchName;
            }

            // Read all files and prepare for upload
            const filesData = await Promise.all(
                uploadFilesState.map(async (file) => {
                    const content = await readFileAsText(file);
                    const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
                    return {
                        path: filePath,
                        content: content
                    };
                })
            );

            // Combine commit message and description
            const fullMessage = commitDescription.trim() 
                ? `${commitMessage}\n\n${commitDescription}`
                : commitMessage;

            // Upload files
            await uploadFiles(projectId, filesData, targetBranch, fullMessage);

            // Reload repository data
            await loadRepositoryData();
            
            // Switch to new branch if created
            if (commitToBranch === 'new') {
                setCurrentBranch(targetBranch);
            }

            // Reset and close modal
            resetUploadModal();
            setShowUploadModal(false);

        } catch (error: any) {
            console.error('Failed to upload files:', error);
            setUploadError(error.response?.data?.message || error.message || 'Failed to upload files');
        } finally {
            setUploading(false);
        }
    };

    const resetUploadModal = () => {
        setUploadFilesState([]);
        setCommitMessage('Add files via upload');
        setCommitDescription('');
        setCommitToBranch('direct');
        setNewBranchName('');
        setUploadError(null);
    };

    const handleCancelUpload = () => {
        if (!uploading) {
            setShowUploadModal(false);
            resetUploadModal();
        }
    };

    const filteredFiles = files.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#0d1117]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading repository...</p>
                </div>
            </div>
        );
    }

    if (!initialized) {
        return (
            <div className="flex items-center justify-center h-full bg-[#0d1117]">
                <div className="text-center">
                    <p className="text-red-400">Failed to initialize repository</p>
                </div>
            </div>
        );
    }

    // If viewing a file
    if (selectedFile) {
        return (
            <GitFileViewer
                projectId={projectId}
                file={selectedFile}
                branch={currentBranch}
                onBack={() => setSelectedFile(null)}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#0d1117] text-white">
            {/* Top Navigation Bar */}
            <div className="bg-[#161b22] border-b border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        {/* Branch Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowBranchMenu(!showBranchMenu)}
                                className="flex items-center gap-2 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                            >
                                <GitBranch className="w-4 h-4" />
                                {currentBranch}
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            
                            {showBranchMenu && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-[#161b22] border border-gray-700 rounded-md shadow-2xl z-20 overflow-hidden">
                                    <div className="px-4 py-2 bg-[#0d1117] border-b border-gray-700">
                                        <span className="text-sm font-semibold text-gray-300">Switch branches</span>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        <div className="px-3 py-1.5 text-xs text-gray-500 font-semibold">BRANCHES</div>
                                        {branches.map((branch) => (
                                            <button
                                                key={branch}
                                                onClick={() => handleBranchSwitch(branch)}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-[#1f6feb] hover:text-white transition-colors ${
                                                    currentBranch === branch ? 'bg-[#1f6feb]/20 text-[#58a6ff] font-semibold' : 'text-gray-300'
                                                }`}
                                            >
                                                {branch}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                                <GitBranch className="w-4 h-4" />
                                <strong>{branches.length}</strong> {branches.length === 1 ? 'Branch' : 'Branches'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Tag className="w-4 h-4" />
                                <strong>0</strong> Tags
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Go to file"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-[#0d1117] border border-gray-600 text-white text-sm px-3 py-1.5 pl-9 rounded-md w-64 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <kbd className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#21262d] text-gray-400 text-xs px-1.5 py-0.5 rounded border border-gray-600">
                                t
                            </kbd>
                        </div>

                        {/* Add Menu */}
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
                                    <button 
                                        onClick={() => {
                                            // TODO: Implement create new file functionality
                                            console.log('Create new file clicked');
                                            setShowAddMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#1f6feb] hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Create new file
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowAddMenu(false);
                                            setShowUploadModal(true);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-[#1f6feb] hover:text-white transition-colors flex items-center gap-2 border-t border-gray-700"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload files
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Code Button */}
                        <div className="relative">
                            <button 
                                onClick={() => setShowCodeMenu(!showCodeMenu)}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-md text-sm font-semibold transition-colors"
                            >
                                <Code2 className="w-4 h-4" />
                                Code
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            
                            {showCodeMenu && (
                                <div className="absolute top-full right-0 mt-2 w-80 bg-[#161b22] border border-gray-700 rounded-md shadow-2xl z-20 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-gray-700">
                                        <p className="text-sm font-semibold text-gray-300 mb-2">Clone</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={`https://github.com/user/repo.git`}
                                                readOnly
                                                className="flex-1 bg-[#0d1117] border border-gray-600 text-gray-300 text-xs px-2 py-1.5 rounded font-mono"
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText('https://github.com/user/repo.git');
                                                    setShowCodeMenu(false);
                                                }}
                                                className="px-3 py-1.5 bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white text-xs rounded transition-colors"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                    <div className="px-4 py-2">
                                        <button className="w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#1f6feb] hover:text-white rounded transition-colors">
                                            Open with GitHub Desktop
                                        </button>
                                        <button className="w-full text-left px-2 py-2 text-sm text-gray-300 hover:bg-[#1f6feb] hover:text-white rounded transition-colors">
                                            Download ZIP
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Latest Commit Banner */}
                {latestCommit && (
                    <div className="flex items-center justify-between bg-[#0d1117] border border-gray-700 rounded-md px-4 py-2 text-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                {latestCommit.author.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[#58a6ff] font-semibold hover:underline cursor-pointer">
                                    {latestCommit.author}
                                </span>
                                <span className="text-gray-300">{latestCommit.message}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400">
                            <a href="#" className="flex items-center gap-1 hover:text-blue-400 transition-colors">
                                <span className="font-mono text-xs">{latestCommit.hash}</span>
                            </a>
                            <span>·</span>
                            <span>{latestCommit.timeAgo}</span>
                            <span>·</span>
                            <button 
                                onClick={() => setActiveTab('commits')}
                                className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                            >
                                <History className="w-4 h-4" />
                                <strong>{stats.commitCount}</strong> Commits
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Tab Switcher */}
            <div className="bg-[#0d1117] border-b border-gray-800 px-6">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'files'
                                ? 'border-orange-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        <Code2 className="w-4 h-4 inline mr-2" />
                        Code
                    </button>
                    <button
                        onClick={() => setActiveTab('commits')}
                        className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'commits'
                                ? 'border-orange-500 text-white'
                                : 'border-transparent text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        <History className="w-4 h-4 inline mr-2" />
                        Commits
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'files' ? (
                    <>
                        {/* Breadcrumb */}
                        {currentPath && (
                            <div className="bg-[#161b22] border-b border-gray-700 px-6 py-3">
                                <button
                                    onClick={handleBackToRoot}
                                    className="text-[#58a6ff] hover:underline text-sm"
                                >
                                    root
                                </button>
                                <span className="text-gray-500 mx-2">/</span>
                                <span className="text-gray-300">{currentPath}</span>
                            </div>
                        )}

                        {/* File List */}
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
                                        className={`flex items-center gap-3 px-4 py-3 hover:bg-[#161b22] cursor-pointer transition-colors group ${
                                            idx !== 0 ? 'border-t border-gray-800' : ''
                                        }`}
                                    >
                                        {file.type === 'folder' ? (
                                            <FolderIcon className="w-4 h-4 text-blue-400" />
                                        ) : (
                                            <FileIcon className="w-4 h-4 text-gray-400" />
                                        )}
                                        <span className="text-[#58a6ff] text-sm font-medium group-hover:underline">
                                            {file.name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* README Preview */}
                        {!currentPath && files.some(f => f.name.toLowerCase() === 'readme.md') && (
                            <GitReadmePreview projectId={projectId} branch={currentBranch} />
                        )}
                    </>
                ) : (
                    <GitCommitHistory projectId={projectId} branch={currentBranch} />
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0d1117] border border-gray-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    {currentPath ? `${currentPath} /` : 'attrition-analysis /'}
                                </h2>
                            </div>
                            <button
                                onClick={handleCancelUpload}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-6">
                            {/* File Drop Zone */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                                    dragActive 
                                        ? 'border-blue-500 bg-blue-500/10' 
                                        : 'border-gray-600 bg-[#161b22]'
                                }`}
                            >
                                <FileIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-white mb-2">
                                    Drag files here to add them to your repository
                                </h3>
                                <p className="text-gray-400 mb-4">
                                    Or{' '}
                                    <label className="text-blue-500 hover:underline cursor-pointer">
                                        choose your files
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleFileInputChange}
                                            className="hidden"
                                        />
                                    </label>
                                </p>
                                
                                {/* Selected Files List */}
                                {uploadFilesState.length > 0 && (
                                    <div className="mt-6 text-left">
                                        <p className="text-sm text-gray-400 mb-2">
                                            Selected files ({uploadFilesState.length}):
                                        </p>
                                        <div className="space-y-1">
                                            {uploadFilesState.map((file, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center gap-2 text-sm text-gray-300 bg-[#0d1117] px-3 py-2 rounded"
                                                >
                                                    <FileIcon className="w-4 h-4 text-gray-400" />
                                                    {file.name}
                                                    <span className="text-gray-500 ml-auto">
                                                        ({(file.size / 1024).toFixed(2)} KB)
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Commit Changes Section */}
                            <div className="mt-8">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Upload className="w-5 h-5 text-blue-400" />
                                    Commit changes
                                </h3>

                                {/* Commit Message */}
                                <input
                                    type="text"
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    placeholder="Add files via upload"
                                    className="w-full bg-[#0d1117] border border-gray-600 text-white px-3 py-2 rounded-md mb-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                />

                                {/* Extended Description */}
                                <textarea
                                    value={commitDescription}
                                    onChange={(e) => setCommitDescription(e.target.value)}
                                    placeholder="Add an optional extended description..."
                                    rows={4}
                                    className="w-full bg-[#0d1117] border border-gray-600 text-white px-3 py-2 rounded-md mb-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                                />

                                {/* Commit Options */}
                                <div className="space-y-3 mb-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={commitToBranch === 'direct'}
                                            onChange={() => setCommitToBranch('direct')}
                                            className="mt-1"
                                            disabled={uploading}
                                        />
                                        <div>
                                            <div className="text-white text-sm">
                                                Commit directly to the <span className="bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-mono text-xs">{currentBranch}</span> branch.
                                            </div>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={commitToBranch === 'new'}
                                            onChange={() => setCommitToBranch('new')}
                                            className="mt-1"
                                            disabled={uploading}
                                        />
                                        <div className="flex-1">
                                            <div className="text-white text-sm mb-2">
                                                Create a <strong>new branch</strong> for this commit and start a pull request.{' '}
                                                <a href="#" className="text-blue-500 hover:underline">
                                                    Learn more about pull requests.
                                                </a>
                                            </div>
                                            {commitToBranch === 'new' && (
                                                <input
                                                    type="text"
                                                    value={newBranchName}
                                                    onChange={(e) => setNewBranchName(e.target.value)}
                                                    placeholder={`patch-${Math.floor(Math.random() * 1000)}`}
                                                    className="w-full bg-[#0d1117] border border-gray-600 text-white px-3 py-1.5 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    disabled={uploading}
                                                />
                                            )}
                                        </div>
                                    </label>
                                </div>

                                {/* Error Message */}
                                {uploadError && (
                                    <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded-md text-red-400 text-sm">
                                        {uploadError}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCommitChanges}
                                        disabled={uploadFilesState.length === 0 || uploading}
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md font-semibold transition-colors flex items-center gap-2"
                                    >
                                        {uploading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                Uploading...
                                            </>
                                        ) : (
                                            'Commit changes'
                                        )}
                                    </button>
                                    <button
                                        onClick={handleCancelUpload}
                                        disabled={uploading}
                                        className="bg-transparent border border-gray-600 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md font-semibold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GitRepositoryBrowser;
