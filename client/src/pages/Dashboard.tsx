import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, getProjects } from "../services/projectService";
import type { Project } from "../types";
import { useAuth } from "../hooks/useAuth";

const Dashboard = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const { user } = useAuth();

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const project = await createProject({ name, description });
      setProjects((prev) => [project, ...prev]);
      setName("");
      setDescription("");
      setShowCreateModal(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create project.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-12 text-white font-sans">
      <div className="mb-16">
        <h1 className="text-4xl font-bold font-mono mb-2 flex items-center gap-3">
            <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Welcome, <span className="text-white">{user?.name || "User"}</span>
        </h1>
        <p className="text-gray-400 text-lg">Manage your projects and collaborate with your team</p>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-sm font-bold text-gray-500 tracking-widest uppercase">Your Projects</h2>
        <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e0] text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2"
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
        </button>
      </div>

      {projects.length === 0 && !loading ? (
        <div className="bg-[#0a0d14] border border-dashed border-gray-800 rounded-xl p-16 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 bg-gray-900/50 rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
             </div>
             <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
             <p className="text-gray-500 mb-8 max-w-sm">Create your first project to get started</p>
             <button 
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-[#6366f1]/10 hover:bg-[#6366f1]/20 text-[#6366f1] border border-[#6366f1]/20 rounded-lg font-medium transition-all flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Project
            </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
                <div 
                    key={project._id || project.id}
                    onClick={() => navigate(`/projects/${project._id || project.id}`)}
                    className="bg-[#0b0c10] border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-all cursor-pointer hover:shadow-lg hover:shadow-indigo-500/5 group"
                >
                    <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-[#15161c] border border-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 group-hover:text-indigo-300 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 13a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                        </div>
                        <span className="text-[10px] font-bold tracking-wider text-gray-500 bg-gray-900 border border-gray-800 px-2 py-1 rounded uppercase">Owner</span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                    <p className="text-sm text-gray-500 mb-8 line-clamp-2 h-10">{project.description || "No description provided."}</p>
                    
                    <div className="flex items-center gap-6 text-xs font-mono text-gray-500">
                        <div className="flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                             </svg>
                             {project.members?.length || 1}
                        </div>
                        <div className="flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                             </svg>
                             {new Date().toLocaleDateString()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* Simplified Create Modal for Demo */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#050505] border border-gray-800 rounded-xl p-8 w-full max-w-lg shadow-2xl relative">
                <button 
                    onClick={() => setShowCreateModal(false)} 
                    className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h3 className="text-2xl font-bold font-mono text-white mb-8">Create New Project</h3>
                
                <form onSubmit={handleCreateProject} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-200 mb-2">Project Name</label>
                        <input 
                            className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            required 
                            placeholder="My Awesome Project" 
                        />
                    </div>
                   <div>
                        <label className="block text-sm font-bold text-gray-200 mb-2">Description</label>
                        <textarea 
                            className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none h-32 resize-none transition-all" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="What's this project about?" 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className="w-full py-3.5 bg-[#6366f1] hover:bg-[#5558e0] text-white rounded-lg font-bold text-base transition-all shadow-lg shadow-indigo-500/20 mt-2"
                    >
                        Create Project
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
