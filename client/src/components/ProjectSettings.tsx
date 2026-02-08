import { useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import type { Project } from "../types";
import { deleteProject } from "../services/projectService";
import { useAuth } from "../hooks/useAuth";
import InviteModal from "./InviteModal";

const ProjectSettings = ({ project }: { project: Project }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const projectId = project._id;
  const isOwner = project.owner?._id === user?.id || project.owner?.id === user?.id;

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      return;
    }
    
    // Double confirmation for safety
    if (!window.confirm("Please verify you want to PERMANENTLY delete this project including all tasks, files, and chats.")) {
        return;
    }

    try {
      setLoading(true);
      await deleteProject(projectId);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      alert("Failed to delete project");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = () => {
    setShowInviteModal(true);
  };

  // Combine owner and members for display if needed, but usually they are separate in DB structure or unified
  // In our type: members: ProjectMember[] which includes user and role.
  // Owner is also separate property on project.
  
  // Let's normalize the list
  const memberList = project.members.map(m => ({
      user: m.user,
      role: m.role,
      joinedAt: m.addedAt || project.createdAt // fallback
  }));

  // Ensure owner is in the list if not already (legacy data support)
  if (!memberList.some(m => (m.user._id || m.user.id) === (project.owner._id || project.owner.id))) {
      memberList.unshift({
          user: project.owner,
          role: 'owner',
          joinedAt: project.createdAt
      });
  }

  return (
    <div className="h-full flex flex-col px-8 py-6 max-w-[1600px] mx-auto overflow-y-auto custom-scrollbar">
      <h2 className="text-2xl font-bold font-mono text-white tracking-tight mb-8">Project Settings</h2>

      {/* Team Members Section */}
      <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                Team Members
            </h3>
            {isOwner && (
                <button 
                    onClick={handleInvite}
                    className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e0] text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Invite Member
                </button>
            )}
        </div>

        <div className="space-y-3">
            {memberList.map((member) => (
                <div key={member.user._id || member.user.id} className="flex items-center justify-between p-4 bg-[#111] border border-gray-800/50 rounded-lg group hover:border-gray-700 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-900/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                            {(member.user.name || "U").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-200 font-mono">{member.user.name}</span>
                                {member.role === 'owner' && (
                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Owner</span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">{member.user.email}</div>
                        </div>
                    </div>
                    <div className="text-xs text-gray-600 font-mono">
                        Joined {format(new Date(member.joinedAt || Date.now()), 'M/d/yyyy')}
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
          <div className="border border-red-900/30 bg-red-900/5 rounded-xl p-6">
            <h3 className="text-lg font-bold text-red-500 font-mono mb-6">Danger Zone</h3>
            
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-bold text-white font-mono mb-1">Delete Project</div>
                    <div className="text-sm text-gray-500 font-mono">Permanently delete this project and all its data</div>
                </div>
                <button 
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete Project
                </button>
            </div>
          </div>
      )}

      {showInviteModal && (
        <InviteModal 
          open={showInviteModal} 
          project={project} 
          onClose={() => setShowInviteModal(false)} 
        />
      )}
    </div>
  );
};

export default ProjectSettings;
