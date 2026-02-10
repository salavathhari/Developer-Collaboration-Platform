import { useEffect, useState } from 'react';
import { getCommitHistory, type Commit } from '../services/gitRepoService';
import { GitCommit, Clock, User } from 'lucide-react';

interface GitCommitHistoryProps {
    projectId: string;
    branch: string;
    limit?: number;
}

const GitCommitHistory: React.FC<GitCommitHistoryProps> = ({ projectId, branch, limit = 50 }) => {
    const [commits, setCommits] = useState<Commit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCommits();
    }, [projectId, branch, limit]);

    const loadCommits = async () => {
        try {
            setLoading(true);
            const data = await getCommitHistory(projectId, branch, limit);
            setCommits(data);
        } catch (error) {
            console.error('Failed to load commits:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-gray-400 text-sm">Loading commits...</p>
                </div>
            </div>
        );
    }

    if (commits.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <GitCommit className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No commits yet</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="space-y-0">
                {commits.map((commit, idx) => (
                    <div
                        key={commit.hash}
                        className={`flex gap-4 py-4 ${
                            idx !== commits.length - 1 ? 'border-b border-gray-800' : ''
                        }`}
                    >
                        {/* Timeline */}
                        <div className="flex flex-col items-center">
                            <div className="w-10 h-10 bg-[#161b22] border-2 border-blue-500 rounded-full flex items-center justify-center">
                                <GitCommit className="w-5 h-5 text-blue-500" />
                            </div>
                            {idx !== commits.length - 1 && (
                                <div className="flex-1 w-0.5 bg-gray-800 mt-2"></div>
                            )}
                        </div>

                        {/* Commit Details */}
                        <div className="flex-1 min-w-0 pb-4">
                            <div className="bg-[#161b22] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
                                {/* Commit Message */}
                                <div className="mb-3">
                                    <h3 className="text-white font-medium text-base mb-1">
                                        {commit.message}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <div className="flex items-center gap-1.5">
                                            <User className="w-3.5 h-3.5" />
                                            <span className="text-[#58a6ff] hover:underline cursor-pointer">
                                                {commit.author}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>{commit.timeAgo}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Commit Hash */}
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">commit</span>
                                        <code className="text-xs font-mono bg-[#0d1117] text-blue-400 px-2 py-1 rounded border border-gray-700 hover:border-blue-500 cursor-pointer transition-colors">
                                            {commit.hash}
                                        </code>
                                    </div>
                                    <button className="text-xs text-gray-400 hover:text-white transition-colors">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Load More (if needed) */}
            {commits.length >= limit && (
                <div className="text-center mt-6">
                    <button className="bg-[#21262d] hover:bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                        Load more commits
                    </button>
                </div>
            )}
        </div>
    );
};

export default GitCommitHistory;
