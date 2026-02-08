import { useEffect, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { getPullRequestById, mergePullRequest, getComments, createComment } from "../services/prService";
import type { Comment, PullRequest } from "../services/prService";
import type { Project } from "../types";
import { useVideo } from "../context/VideoContext";

// Mock diff for demonstration
const MOCK_DIFF_OLD = `
function add(a, b) {
  return a + b;
}

function sub(a, b) {
  return a - b;
}
`;

const MOCK_DIFF_NEW = `
function add(a, b) {
  console.log('Adding', a, b);
  return a + b;
}

// Subtraction feature removed as requested
// function sub(a, b) {
//   return a - b;
// }

function multiply(a, b) {
  return a * b;
}
`;

const PRDetail = ({ project, prId, onBack }: { project: Project; prId: string; onBack?: () => void }) => {
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const { startCall } = useVideo();

  useEffect(() => {
    const load = async () => {
      try {
        const [prData, commentsData] = await Promise.all([
           getPullRequestById(prId),
           getComments(prId)
        ]);
        setPr(prData);
        setComments(commentsData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (prId) load();
  }, [prId]);

  const handleMerge = async () => {
      if(!pr) return;
      if(!confirm("Merge this pull request?")) return;
      try {
          const updated = await mergePullRequest(pr._id);
          setPr(updated);
      } catch(err) {
          alert("Merge failed");
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

  if(loading) return <div className="p-10 text-center text-gray-500">Loading PR...</div>;
  if(!pr) return <div className="p-10 text-center text-red-500">PR Not Found</div>;

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-800 p-6 bg-[#0d1017]">
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
                        <button onClick={handleMerge} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-purple-900/20">
                            Merge Pull Request
                        </button>
                    )}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-auto flex">
            {/* Main Content: Diff */}
            <div className="flex-1 p-6 overflow-y-auto">
                 <div className="mb-6">
                    <h3 className="font-bold text-gray-300 mb-2">Description</h3>
                    <div className="bg-[#0d1017] p-4 rounded border border-gray-800 text-gray-300 whitespace-pre-wrap">
                        {pr.description || "No description provided."}
                    </div>
                 </div>

                 <div className="mb-6">
                     <h3 className="font-bold text-gray-300 mb-2">Files Changed (1)</h3>
                     <div className="border border-gray-700 rounded-lg overflow-hidden bg-[#0d1117]">
                         <div className="bg-[#161b22] px-4 py-2 border-b border-gray-700 text-sm font-mono text-gray-300">
                             src/utils/math.js
                         </div>
                         <ReactDiffViewer 
                            oldValue={MOCK_DIFF_OLD} 
                            newValue={MOCK_DIFF_NEW} 
                            splitView={true}
                            useDarkTheme={true}
                            styles={{
                                variables: {
                                    dark: {
                                        diffViewerBackground: '#0d1117',
                                        diffViewerColor: '#FFF',
                                        addedBackground: '#2ea04326', // GitHub green
                                        addedColor: 'white',
                                        removedBackground: '#f8514926', // GitHub red
                                        removedColor: 'white',
                                        wordAddedBackground: '#2ea04366',
                                        wordRemovedBackground: '#f8514966',
                                        addedGutterBackground: '#2ea04326',
                                        removedGutterBackground: '#f8514926',
                                        gutterBackground: '#0d1117',
                                        gutterColor: '#8b949e',
                                        gutterBorder: '#30363d',
                                        lineNumberColor: '#8b949e',
                                    }
                                }
                            }}
                         />
                     </div>
                 </div>
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