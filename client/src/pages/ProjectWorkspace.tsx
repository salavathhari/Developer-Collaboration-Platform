import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { getProjects } from "../services/projectService";
import type { FileAsset, Project, User } from "../types";
import ChatRoom from "../components/ChatRoom";
import TaskBoard from "../components/TaskBoard";
import PresenceBar from "../components/PresenceBar";
import NotificationsBell from "../components/NotificationsBell";
import ActivityFeed from "../components/ActivityFeed";
import AiAssistant from "../components/AiAssistant";
import TaskInsights from "../components/TaskInsights";
import { useSocket } from "../hooks/useSocket";
import FileUploader from "../components/FileUploader";

const ProjectWorkspace = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "chat" | "tasks" | "files" | "members" | "analytics"
  >("chat");
  const [files, setFiles] = useState<FileAsset[]>([]);
  const token = localStorage.getItem("token");
  const socket = useSocket(token);

  useEffect(() => {
    const loadProject = async () => {
      const projects = await getProjects();
      const selected = projects.find((item) => item._id === projectId) || null;
      setProject(selected);
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

    const onFileUploaded = ({ file }: { file: FileAsset }) => {
      if (file.projectId === projectId) {
        setFiles((prev) => [file, ...prev]);
      }
    };

    socket.on("file_uploaded", onFileUploaded);

    return () => {
      socket.emit("leave_room", { projectId });
      socket.off("presence_update", handler);
      socket.off("file_uploaded", onFileUploaded);
    };
  }, [socket, projectId]);

  const members = useMemo(() => {
    if (!project) {
      return [];
    }
    const list: User[] = project.members.map((member) => member.user);
    if (project.owner) {
      list.push(project.owner);
    }
    const seen = new Set<string>();
    return list.filter((item) => {
      const id = item.id || item._id || "";
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, [project]);

  if (!project) {
    return <div className="state-card">Loading workspace...</div>;
  }

  const membersWithOwner = project.owner
    ? [project.owner, ...members]
    : members;

  return (
    <section className="workspace">
      <header className="workspace-header">
        <div>
          <h2>{project.name}</h2>
          <p>{project.description}</p>
          <div className="member-avatars">
            {membersWithOwner.slice(0, 6).map((member) => (
              <div key={member.id || member._id} className="avatar-chip">
                {member.avatar ? (
                  <img src={member.avatar} alt={member.name} />
                ) : (
                  <span>{member.name?.[0] || "U"}</span>
                )}
              </div>
            ))}
            {membersWithOwner.length > 6 ? (
              <div className="avatar-chip">+{membersWithOwner.length - 6}</div>
            ) : null}
          </div>
        </div>
        <NotificationsBell />
      </header>

      <PresenceBar members={members} onlineUserIds={online} />

      <div className="workspace-tabs">
        {([
          { key: "chat", label: "Chat" },
          { key: "tasks", label: "Task Board" },
          { key: "files", label: "Files" },
          { key: "members", label: "Members" },
          { key: "analytics", label: "Analytics" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            className={
              activeTab === tab.key
                ? "tab-button active"
                : "tab-button"
            }
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="workspace-panels">
        {activeTab === "chat" ? (
          <ChatRoom project={project} />
        ) : null}
        {activeTab === "tasks" ? (
          <TaskBoard projectId={project._id} />
        ) : null}
        {activeTab === "files" ? (
          <div className="files-panel">
            <div className="panel-header">
              <div>
                <h3>Shared files</h3>
                <p>Upload assets and documentation for the team.</p>
              </div>
              <FileUploader
                projectId={project._id}
                onUploaded={(file) => setFiles((prev) => [file, ...prev])}
              />
            </div>
            {files.length === 0 ? (
              <div className="state-card">No files uploaded yet.</div>
            ) : (
              <div className="file-table">
                {files.map((file) => (
                  <div key={file._id} className="file-row">
                    <div>
                      <strong>{file.filename}</strong>
                      <small>{Math.round(file.size / 1024)} KB</small>
                    </div>
                    <a className="secondary-button light" href={file.url}>
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {activeTab === "members" ? (
          <div className="members-panel">
            <h3>Members</h3>
            <div className="members-grid">
              {membersWithOwner.map((member) => (
                <div key={member.id || member._id} className="member-card">
                  <div className="avatar">
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.name} />
                    ) : (
                      <span>{member.name?.[0] || "U"}</span>
                    )}
                  </div>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.email}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {activeTab === "analytics" ? (
          <div className="analytics-panel">
            <TaskInsights projectId={project._id} />
            <ActivityFeed projectId={project._id} />
          </div>
        ) : null}
      </div>

      <AiAssistant projectId={project._id} />
    </section>
  );
};

export default ProjectWorkspace;
