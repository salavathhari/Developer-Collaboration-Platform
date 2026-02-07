import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { getProjects } from "../services/projectService";
import type { FileAsset, Project, User } from "../types";
import ChatRoom from "../components/ChatRoom";
import TaskBoard from "../components/TaskBoard";
import FilesView from "../components/FilesView";
import AnalyticsView from "../components/AnalyticsView";
import AiAssistant from "../components/AiAssistant";
import ProjectSettings from "../components/ProjectSettings";
import { useSocket } from "../hooks/useSocket";

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "chat" | "tasks" | "files" | "analytics" | "ai" | "settings"
  >("chat");
  const [files, setFiles] = useState<FileAsset[]>([]);
  const token = localStorage.getItem("token");
  const socket = useSocket(token);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const projects = await getProjects();
        // Fallback for demo if ID doesn't match db
        const selected = projects.find((item) => item._id === projectId || item.id === projectId) || projects[0];
        setProject(selected);
      } catch (err) {
        console.error(err);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  useEffect(() => {
    if (!socket || !projectId) {
      return;
    }

    const handler = (payload: { projectId: string; onlineUserIds: string[] }) => {
      if (payload.projectId === projectId) {
        setOnline(payload.onlineUserIds);
      }
    };

    socket.on("presence_update", handler);
    socket.emit("join_room", { projectId });

    return () => {
      socket.emit("leave_room", { projectId });
      socket.off("presence_update", handler);
    };
  }, [socket, projectId]);

  const members = useMemo(() => {
    if (!project) return [];
    return project.members || [];
  }, [project]);

  if (!project) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-gray-500 font-mono gap-4">
        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="animate-pulse">Loading workspace...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'chat', label: 'Chat', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
    )},
    { id: 'tasks', label: 'Tasks', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
    )},
    { id: 'files', label: 'Files', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    )},
    { id: 'analytics', label: 'Analytics', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    )},
    { id: 'ai', label: 'AI Assistant', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    )},
    { id: 'settings', label: 'Settings', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#050505] sticky top-0 z-20">
        <div className="flex items-center gap-6">
            <button 
                onClick={() => navigate('/dashboard')} 
                className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-wider cursor-pointer hover:scale-105 transform duration-200"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
            </button>
            <div className="flex flex-col">
                <h1 className="text-xl font-bold font-mono tracking-wide flex items-center gap-2">
                    {project.name}
                </h1>
                <p className="text-xs text-gray-500 font-medium">{project.description || "No description provided"}</p>
            </div>
        </div>

        <div className="flex items-center gap-2 bg-[#111] px-3 py-1.5 rounded-lg border border-white/5">
             <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
             <span className="text-sm font-bold text-gray-300">{members.length || 1}</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 border-b border-white/5 bg-[#050505]">
         {tabs.map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`cursor-pointer flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                    activeTab === tab.id 
                    ? 'border-gray-500 text-white bg-white/5' 
                    : 'border-transparent text-gray-500 hover:text-white hover:bg-white/10 hover:-translate-y-0.5'
                }`}
             >
                {tab.icon}
                {tab.label}
             </button>
         ))}
      </div>

      {/* Content Area */}
      <main className="flex-1 overflow-hidden relative bg-[#050505]">
          {activeTab === 'chat' && <ChatRoom project={project} />}
          {activeTab === 'tasks' && <TaskBoard project={project} />}
          {activeTab === 'files' && <FilesView project={project} />}
          {activeTab === 'analytics' && <AnalyticsView project={project} />}
          {activeTab === 'ai' && <AiAssistant project={project} />}
          {activeTab === 'settings' && <ProjectSettings project={project} />}
      </main>
    </div>
  );
};

export default ProjectWorkspace;
