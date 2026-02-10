import { useState, useEffect } from "react";
import { createPullRequest, getBranches } from "../services/prService";
import type { Project } from "../types";

interface PRModalProps {
    project: Project;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const PRModal = ({ project, isOpen, onClose, onSuccess }: PRModalProps) => {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [headBranch, setHeadBranch] = useState("");
    const [baseBranch, setBaseBranch] = useState("main");
    const [branches, setBranches] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [reviewers, setReviewers] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && project) {
            loadBranches();
        }
    }, [isOpen, project]);

    const loadBranches = async () => {
        try {
            const branchList = await getBranches(project._id);
            setBranches(branchList);
            if (branchList.length > 0 && !headBranch) {
                setHeadBranch(branchList.find(b => b !== 'main') || branchList[0]);
            }
        } catch (err) {
            console.error("Failed to load branches", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !headBranch) return;

        setLoading(true);
        try {
            await createPullRequest(project._id, {
                title,
                description,
                headBranch,
                baseBranch,
                reviewers
            });
            onSuccess();
            handleClose();
        } catch (err: any) {
            alert(err?.response?.data?.message || "Failed to create PR");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setTitle("");
        setDescription("");
        setHeadBranch("");
        setBaseBranch("main");
        setReviewers([]);
        onClose();
    };

    const toggleReviewer = (userId: string) => {
        setReviewers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#0d1117] border border-gray-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-[#0d1117] border-b border-gray-800 p-6 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white">Create Pull Request</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Branch Selection */}
                    <div className="bg-[#161b22] border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex-1">
                                <label className="block text-gray-400 mb-2 font-medium">Base Branch</label>
                                <select
                                    value={baseBranch}
                                    onChange={(e) => setBaseBranch(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                                >
                                    {branches.map(branch => (
                                        <option key={branch} value={branch}>{branch}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="pt-6 text-gray-500">←</div>
                            <div className="flex-1">
                                <label className="block text-gray-400 mb-2 font-medium">Compare Branch</label>
                                <select
                                    value={headBranch}
                                    onChange={(e) => setHeadBranch(e.target.value)}
                                    className="w-full bg-[#0d1117] border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    required
                                >
                                    <option value="">Select branch...</option>
                                    {branches.filter(b => b !== baseBranch).map(branch => (
                                        <option key={branch} value={branch}>{branch}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-gray-300 font-medium mb-2">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief summary of changes..."
                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-gray-300 font-medium mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe the changes in detail..."
                            rows={6}
                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
                        />
                    </div>

                    {/* Reviewers */}
                    <div>
                        <label className="block text-gray-300 font-medium mb-2">Reviewers</label>
                        <div className="bg-[#0d1117] border border-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {project.members?.length > 0 ? (
                                project.members.map(member => (
                                    <label
                                        key={member.user._id || member.user.id || member.user}
                                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={reviewers.includes(member.user._id || member.user.id || member.user)}
                                            onChange={() => toggleReviewer(member.user._id || member.user.id || member.user)}
                                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
                                        />
                                        <span className="text-gray-300 text-sm">
                                            {member.user.name || member.user.email || 'Team Member'}
                                        </span>
                                    </label>
                                ))
                            ) : (
                                <p className="text-gray-500 text-sm">No team members available</p>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-5 py-2.5 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !title.trim() || !headBranch}
                            className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold transition-colors"
                        >
                            {loading ? "Creating..." : "Create Pull Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PRModal;
