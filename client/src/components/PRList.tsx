import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPullRequests, createPullRequest } from "../services/prService";
import type { PullRequest } from "../services/prService";
import type { Project } from "../types";

const PRList = ({ project, onSelect }: { project: Project; onSelect: (id: string) => void }) => {
  const [prs, setPrs] = useState<PullRequest[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newPR, setNewPR] = useState({ title: "", description: "", baseBranch: "main", headBranch: "develop" });

  useEffect(() => {
    const fetchPRs = async () => {
      try {
        const data = await getPullRequests(project._id);
        setPrs(data);
      } catch (error) {
        console.error("Failed to fetch PRs:", error);
      }
    };
    fetchPRs();
  }, [project._id]);

  const handleCreate = async () => {
    try {
      const pr = await createPullRequest(project._id, newPR);
      setPrs([...prs, pr]);
      setShowCreate(false);
      setNewPR({ title: "", description: "", baseBranch: "main", headBranch: "develop" });
    } catch (error) {
      console.error("Failed to create PR:", error);
      alert("Failed to create PR");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white p-6 overflow-hidden">
      <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
        <h2 className="text-xl font-bold">Pull Requests</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          New Pull Request
        </button>
      </div>

      <div className="overflow-auto flex-1 space-y-2">
        {prs.map((pr) => (
          <div key={pr._id} className="p-4 bg-[#0d1017] border border-gray-800 rounded-lg hover:border-gray-600 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <button onClick={() => onSelect(pr._id)} className="text-lg font-semibold text-blue-400 hover:underline text-left">
                    {pr.title}
                </button>
                <div className="text-xs text-gray-500 mt-1 flex gap-2">
                  <span className={`px-1.5 py-0.5 rounded-full capitalize ${
                      pr.status === 'open' ? 'bg-green-500/10 text-green-400' : 
                      pr.status === 'merged' ? 'bg-purple-500/10 text-purple-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {pr.status}
                  </span>
                  <span>#{pr._id.substring(0,6)} by {pr.author?.name || 'Unknown'}</span>
                  <span>created {new Date(pr.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center text-xs text-gray-500 font-mono bg-gray-900 rounded px-2 py-1">
                 {pr.headBranch} &rarr; {pr.baseBranch}
              </div>
            </div>
          </div>
        ))}
        
        {prs.length === 0 && (
            <div className="text-center text-gray-500 py-10">No pull requests found.</div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#0d1017] border border-gray-800 rounded-xl p-6 w-[500px]">
            <h3 className="text-lg font-bold mb-4">Create Pull Request</h3>
            <div className="space-y-4">
              <input
                className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-sm text-white"
                placeholder="Title"
                value={newPR.title}
                onChange={(e) => setNewPR({ ...newPR, title: e.target.value })}
              />
              <textarea
                className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-sm text-white h-24"
                placeholder="Description"
                value={newPR.description}
                onChange={(e) => setNewPR({ ...newPR, description: e.target.value })}
              />
              <div className="flex gap-4">
                  <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Base Branch</label>
                      <input
                        className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-sm text-white"
                        placeholder="main"
                        value={newPR.baseBranch}
                        onChange={(e) => setNewPR({ ...newPR, baseBranch: e.target.value })}
                      />
                  </div>
                  <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Head Branch</label>
                      <input
                        className="w-full bg-[#050505] border border-gray-700 rounded p-2 text-sm text-white"
                        placeholder="feature/..."
                        value={newPR.headBranch}
                        onChange={(e) => setNewPR({ ...newPR, headBranch: e.target.value })}
                      />
                  </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white text-sm px-3 py-1.5">Cancel</button>
              <button onClick={handleCreate} className="bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-1.5 rounded">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRList;
