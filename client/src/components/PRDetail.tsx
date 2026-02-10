import { useEffect, useRef, useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";
import { getPullRequestById, mergePullRequest, approvePullRequest, rejectPullRequest, getComments, createComment, getPullRequestFile, getCommitHistory } from "../services/prService";
import type { Comment, PullRequest, Commit } from "../services/prService";
import type { Project, Task } from "../types";
import { useVideo } from "../context/VideoContext";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../hooks/useSocket";
import { getProjectFiles, uploadFile as uploadAttachmentFile, type Attachment } from "../services/attachmentService";
import { taskService } from "../services/taskService";
import FileList from "./FileList";

const PRDetail = ({ project, prId, onBack }: { project: Project; prId: string; onBack?: () => void }) => {
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'files' | 'commits'>('files');

    const [linkedTasks, setLinkedTasks] = useState<Task[]>([]);
    const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState("");

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<{ oldCode: string, newCode: string }>({ oldCode: "", newCode: "" });
  const [loadingFile, setLoadingFile] = useState(false);

  const { startCall } = useVideo();
  const { user } = useAuth();
  const socket = useSocket(localStorage.getItem("token"));

  useEffect(() => {
    const load = async () => {
      try {
        const [prData, commentsData] = await Promise.all([
           getPullRequestById(prId),
           getComments(prId)
        ]);
                setPr(prData.pr);
                setLinkedTasks(Array.isArray(prData.linkedTasks) ? prData.linkedTasks : []);
        setComments(commentsData);
                if (prData.pr?.filesChanged?.length > 0) {
                        const firstFile = prData.pr.filesChanged[0].file || prData.pr.filesChanged[0].path;
                        setActiveFile(firstFile || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (prId) load();
  }, [prId]);

  useEffect(() => {
      if (activeTab === 'commits' && commits.length === 0 && prId) {
          loadCommits();
      }
  }, [activeTab, prId]);

  const loadCommits = async () => {
      try {
          const commitData = await getCommitHistory(prId);
          setCommits(commitData);
      } catch (err) {
          console.error("Failed to load commits", err);
      }
  };

  useEffect(() => {
      if (!activeFile || !prId) return;
      const fetchFile = async () => {
          setLoadingFile(true);
          try {
              const { baseContent, headContent } = await getPullRequestFile(prId, activeFile);
              setFileContent({ oldCode: baseContent, newCode: headContent });
          } catch (e) {
              console.error(e);
              setFileContent({ oldCode: "", newCode: "Error loading content" });
          } finally {
              setLoadingFile(false);
          }
      };
      fetchFile();
  }, [activeFile, prId]);

  useEffect(() => {
      if (!project?._id || !prId) return;
      const loadFiles = async () => {
          try {
              const files = await getProjectFiles({
                  projectId: project._id,
                  context: "pr",
                  contextId: prId,
              });
              setAttachments(files);
          } catch (error) {
              console.error("Failed to load PR files", error);
          }
      };

      const loadTasks = async () => {
          try {
              const result = await taskService.getTasks(project._id);
              const tasks = Array.isArray(result.tasks) ? result.tasks : [];
              setAvailableTasks(tasks);
          } catch (error) {
              console.error("Failed to load tasks", error);
          }
      };

      loadFiles();
      loadTasks();
  }, [project?._id, prId]);

  useEffect(() => {
      if(!socket || !prId) return;

      const handleUpdate = (updatedPr: PullRequest) => {
          if (updatedPr._id === prId) {
              setPr(prev => prev ? { ...prev, ...updatedPr } : updatedPr);
          }
      };

      const handleComment = (newComment: Comment) => {
          if (newComment.pullRequestId === prId) {
              setComments(prev => [...prev, newComment]);
          }
      };

      socket.on("pr_updated", handleUpdate);
      socket.on("pr_comment_added", handleComment);
      socket.on("pr_merged", () => alert("PR Merged!"));
      
      return () => {
          socket.off("pr_updated", handleUpdate);
          socket.off("pr_comment_added", handleComment);
          socket.off("pr_merged");
      };
  }, [socket, prId]);

  const handleMerge = async () => {
      if(!pr) return;
      if(!confirm("Merge this pull request?")) return;
      try {
          await mergePullRequest(pr._id);
      } catch(err) {
          alert("Merge failed");
      }
  };

  const handleApprove = async () => {
      if(!pr) return;
      try {
          await approvePullRequest(pr._id);
      } catch(err) {
          console.error(err);
      }
  };

  const handleReject = async () => {
      if(!pr) return;
      if(!confirm("Reject this pull request?")) return;
      try {
          await rejectPullRequest(pr._id);
      } catch(err) {
          console.error(err);
      }
  };

  const handeSubmitComment = async () => {
      if(!newComment.trim() || !pr) return;
      try {
          // Just global comment for now
          const c = await createComment(pr._id, { filePath: 'general', lineNumber: 0, content: newComment });
          setComments([...comments, c]);
          setNewComment("");
      } catch(err) {
          console.error(err);
      }
  };

  const handleLinkTask = async () => {
      if (!selectedTaskId || !pr) return;
      try {
          await taskService.linkPR(project._id, selectedTaskId, { prId: pr._id });
          const refreshed = await taskService.getTasks(project._id, { linkedPRId: pr._id });
          setLinkedTasks(Array.isArray(refreshed.tasks) ? refreshed.tasks : []);
          setSelectedTaskId("");
      } catch (error) {
          console.error("Failed to link task", error);
      }
  };

  const handleUploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !pr) return;
      try {
          setUploadingFile(true);
          const uploaded = await uploadAttachmentFile({
              projectId: project._id,
              relatedPR: pr._id,
              file,
          });
          setAttachments((prev) => [uploaded, ...prev]);
      } catch (error) {
          console.error("Failed to upload file", error);
      } finally {
          setUploadingFile(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
      }
  };

  if(loading) return <div className="p-10 text-center text-gray-500">Loading PR...</div>;
  if(!pr) return <div className="p-10 text-center text-red-500">PR Not Found</div>;

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 border-b border-gray-800 p-6 bg-[#0d1017]/95 backdrop-blur-sm">
            <div className="flex items-center gap-4 mb-4">
                {onBack && (
                     <button onClick={onBack} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back
                     </button>
                )}
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        {pr.title} <span className="text-gray-500 font-mono text-lg">#{pr._id.substring(0, 6)}</span>
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className={`px-2 py-0.5 rounded-full uppercase font-bold text-xs ${
                            pr.status === 'open' ? 'bg-green-600 text-white' : 
                            pr.status === 'merged' ? 'bg-purple-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                            {pr.status}
                        </span>
                        <span className="text-gray-400">
                            <b>{pr.author?.name}</b> wants to merge into <code className="bg-gray-800 px-1 rounded">{pr.baseBranch}</code> from <code className="bg-gray-800 px-1 rounded">{pr.headBranch}</code>
                        </span>
                    </div>
                    
                    {/* Reviewer Badges */}
                    {pr.reviewers && pr.reviewers.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Reviewers:</span>
                            <div className="flex items-center gap-2">
                                                                {pr.reviewers.map(reviewer => {
                                                                        const isApproved = Array.isArray(pr.approvals)
                                                                            ? pr.approvals.some((approval: any) => {
                                                                                    if (typeof approval === "string") return approval === reviewer._id;
                                                                                    return approval.userId?._id === reviewer._id || approval.userId === reviewer._id;
                                                                                })
                                                                            : false;
                                    return (
                                        <div key={reviewer._id} className="flex items-center gap-1 bg-gray-800 rounded-full pr-2 pl-1 py-1">
                                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                {reviewer.name?.substring(0, 2).toUpperCase() || '?'}
                                            </div>
                                            <span className="text-xs text-gray-300">{reviewer.name}</span>
                                            {isApproved && (
                                                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-2">
                     <button
                        onClick={() => startCall(project._id, "code_review", pr._id)}
                        className="flex items-center gap-2 bg-indigo-900/30 border border-indigo-500/50 hover:bg-indigo-900/50 text-indigo-200 px-4 py-2 rounded-lg font-medium transition-colors"
                     >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Live Review
                     </button>
                    {pr.status === 'open' && (
                        <>
                            <button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
                                Approve
                            </button>
                            <button onClick={handleReject} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm">
                                Reject
                            </button>
                             {(user?.id === project.owner._id || user?.id === project.owner.id || user?.id === pr.author._id) && (
                                <button 
                                    onClick={handleMerge} 
                                    className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-purple-900/30 transition-all duration-300 hover:scale-105 hover:shadow-purple-900/50 animate-pulse"
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                        </svg>
                                        Merge
                                    </span>
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
            
             {/* Metadata Bar */}
            <div className="flex gap-6 text-sm text-gray-400 px-6 pb-4 bg-[#0d1017] border-b border-gray-800 -mt-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-300">{pr.reviewers?.length || 0}</span> Reviewers
                </div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-300">{pr.approvals?.length || 0}</span> Approvals
                </div>
                 <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-300">{pr.filesChanged?.length || 0}</span> Files Changed
                </div>
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
             {/* File List Sidebar */}
             <div className="w-64 border-r border-gray-800 bg-[#0d1017] overflow-y-auto hidden md:block">
                 <div className="p-4 font-bold text-xs uppercase text-gray-500 tracking-wider">Changed Files</div>
                 <ul>
                     {pr.filesChanged?.map(f => {
                         const filePath = f.file || f.path || "";
                         return (
                         <li 
                            key={filePath} 
                            onClick={() => setActiveFile(filePath)}
                            className={`px-4 py-2 cursor-pointer text-sm truncate flex justify-between items-center ${activeFile === filePath ? 'bg-indigo-900/30 text-indigo-300 border-l-2 border-indigo-500' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                         >
                             <span className="truncate flex-1" title={filePath}>{filePath}</span>
                             <span className="ml-2 text-[10px] flex gap-1">
                                <span className="text-green-500">+{f.additions}</span>
                                <span className="text-red-500">-{f.deletions}</span>
                             </span>
                         </li>
                        );
                     })}
                 </ul>
             </div>

            {/* Main Content: Diff */}
            <div className="flex-1 p-6 overflow-y-auto w-full">
                 <div className="mb-6">
                    <h3 className="font-bold text-gray-300 mb-2">Description</h3>
                    <div className="bg-[#0d1017] p-4 rounded border border-gray-800 text-gray-300 whitespace-pre-wrap">
                        {pr.description || "No description provided."}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                     <div className="bg-[#0d1017] border border-gray-800 rounded-lg p-4">
                         <div className="flex items-center justify-between mb-3">
                             <h3 className="font-bold text-gray-300">Linked Tasks</h3>
                             <div className="flex items-center gap-2">
                                 <select
                                     value={selectedTaskId}
                                     onChange={(e) => setSelectedTaskId(e.target.value)}
                                     className="bg-[#050505] border border-gray-700 text-gray-300 text-xs rounded px-2 py-1"
                                 >
                                     <option value="">Select task...</option>
                                     {availableTasks
                                                                             .filter((task) => {
                                                                                 if (!task.linkedPRId) return true;
                                                                                 if (typeof task.linkedPRId === "string") return task.linkedPRId === pr._id;
                                                                                 return task.linkedPRId._id === pr._id;
                                                                             })
                                       .map((task) => (
                                         <option key={task._id} value={task._id}>
                                           {task.title}
                                         </option>
                                       ))}
                                 </select>
                                 <button
                                     onClick={handleLinkTask}
                                     disabled={!selectedTaskId}
                                     className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 text-white px-2 py-1 rounded"
                                 >
                                     Link
                                 </button>
                             </div>
                         </div>
                         {linkedTasks.length === 0 ? (
                             <div className="text-sm text-gray-500">No tasks linked yet.</div>
                         ) : (
                             <ul className="space-y-2">
                                 {linkedTasks.map((task) => (
                                     <li key={task._id} className="flex items-center justify-between bg-[#161b22] border border-gray-800 rounded p-2">
                                         <div className="text-sm text-gray-300 truncate">{task.title}</div>
                                         <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-400">
                                             {task.status}
                                         </span>
                                     </li>
                                 ))}
                             </ul>
                         )}
                     </div>

                     <div className="bg-[#0d1017] border border-gray-800 rounded-lg p-4">
                         <div className="flex items-center justify-between mb-3">
                             <h3 className="font-bold text-gray-300">PR Attachments</h3>
                             <div>
                                 <button
                                     onClick={() => fileInputRef.current?.click()}
                                     className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded"
                                 >
                                     {uploadingFile ? "Uploading..." : "Add File"}
                                 </button>
                                 <input
                                     ref={fileInputRef}
                                     type="file"
                                     className="hidden"
                                     onChange={handleUploadAttachment}
                                 />
                             </div>
                         </div>
                         <FileList files={attachments} className="bg-transparent" />
                     </div>
                 </div>

                 {/* Tab Switcher */}
                 <div className="mb-6 border-b border-gray-800">
                     <div className="flex space-x-4">
                         <button
                             onClick={() => setActiveTab('files')}
                             className={`px-4 py-2 font-medium transition-colors ${
                                 activeTab === 'files'
                                     ? 'text-blue-400 border-b-2 border-blue-400'
                                     : 'text-gray-400 hover:text-gray-300'
                             }`}
                         >
                             Files Changed ({pr.filesChanged?.length || 0})
                         </button>
                         <button
                             onClick={() => setActiveTab('commits')}
                             className={`px-4 py-2 font-medium transition-colors ${
                                 activeTab === 'commits'
                                     ? 'text-blue-400 border-b-2 border-blue-400'
                                     : 'text-gray-400 hover:text-gray-300'
                             }`}
                         >
                             Commits ({commits.length})
                         </button>
                     </div>
                 </div>

                 {activeTab === 'files' && (<div className="mb-6">
                     <div className="flex items-center justify-between mb-2">
                         <h3 className="font-bold text-gray-300">
                             {activeFile ? `Diff: ${activeFile}` : 'Files Changed'}
                         </h3>
                     </div>
                     <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0d1117]">
                         <div className="bg-[#161b22] px-4 py-2 border-b border-gray-700 text-sm font-mono text-gray-300">
                             {activeFile || 'Select a file'}
                         </div>
                         {loadingFile ? (
                             <div className="p-10 text-center text-gray-500">Loading diff...</div>
                         ) : (
                            <ReactDiffViewer 
                                oldValue={fileContent.oldCode} 
                                newValue={fileContent.newCode} 
                                splitView={true}
                                useDarkTheme={true}
                                styles={{
                                    variables: {
                                        dark: {
                                            diffViewerBackground: '#0d1117',
                                            diffViewerColor: '#FFF',
                                            addedBackground: '#2ea04326', 
                                            addedColor: 'white',
                                            removedBackground: '#f8514926',
                                            removedColor: 'white',
                                            wordAddedBackground: '#2ea04366',
                                            wordRemovedBackground: '#f8514966',
                                            addedGutterBackground: '#2ea04326',
                                            removedGutterBackground: '#f8514926',
                                            gutterBackground: '#0d1117',
                                            gutterColor: '#8b949e',
                                        }
                                    }
                                }}
                            />
                         )}
                     </div>
                 </div>
                 )}

                 {activeTab === 'commits' && (
                     <div className="space-y-4">
                         {commits.length === 0 ? (
                             <div className="text-center text-gray-500 py-8">No commits found.</div>
                         ) : (
                             commits.map((commit, idx) => (
                                 <div key={idx} className="bg-[#161b22] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                                     <div className="flex items-start space-x-3">
                                         <div className="flex-shrink-0 w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-gray-300 font-mono text-xs">
                                             {commit.author?.substring(0, 2).toUpperCase() || 'UN'}
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <div className="flex items-center space-x-2 mb-1">
                                                 <span className="font-semibold text-gray-200">{commit.author || 'Unknown'}</span>
                                                 <span className="text-gray-500 text-xs">committed on {new Date(commit.timestamp).toLocaleDateString()}</span>
                                             </div>
                                             <p className="text-gray-300 mb-2">{commit.message}</p>
                                             <div className="flex items-center space-x-3">
                                                 <code className="text-xs font-mono text-blue-400 bg-[#0d1117] px-2 py-1 rounded">
                                                     {commit.hash?.substring(0, 7)}
                                                 </code>
                                                 <span className="text-xs text-gray-500">{commit.email}</span>
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             ))
                         )}
                     </div>
                 )}
            </div>

            {/* Sidebar: Reviews/Comments */}
            <div className="w-[350px] border-l border-gray-800 bg-[#0d1017] flex flex-col">
                <div className="p-4 border-b border-gray-800 font-bold text-gray-200">
                    Discussion
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {comments.map(c => (
                        <div key={c._id} className="bg-[#161b22] border border-gray-800 rounded p-3">
                             <div className="flex justify-between items-center mb-1">
                                 <span className="font-bold text-xs text-blue-400">{c.author?.name}</span>
                                 <span className="text-[10px] text-gray-500">{new Date(c.createdAt || Date.now()).toLocaleDateString()}</span>
                             </div>
                             <p className="text-sm text-gray-300">{c.content}</p>
                        </div>
                    ))}
                    {comments.length === 0 && <div className="text-center text-gray-600 text-sm">No comments yet.</div>}
                </div>
                <div className="p-4 border-t border-gray-800">
                    <textarea
                        className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-sm text-white h-20 mb-2 resize-none"
                        placeholder="Leave a comment..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                    />
                    <button onClick={handeSubmitComment} className="w-full bg-[#238636] hover:bg-[#2ea043] text-white py-1.5 rounded text-sm font-bold">
                        Comment
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default PRDetail;