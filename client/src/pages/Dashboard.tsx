import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import ProjectCard from "../components/ProjectCard";
import MemberListPreview from "../components/MemberListPreview";
import InviteModal from "../components/InviteModal";
import { createProject, getProjects } from "../services/projectService";
import type { Project } from "../types";
import { useAuth } from "../hooks/useAuth";

const Dashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
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
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to create project.");
    }
  };

  return (
    <section className="dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Your projects</h2>
          <p>Track active workspaces and team activity.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button light" type="button">
            Invite team
          </button>
          <button className="primary-button" type="button">
            New workspace
          </button>
        </div>
      </header>

      <div className="stats-strip">
        <div>
          <span>{projects.length}</span>
          <small>Active projects</small>
        </div>
        <div>
          <span>{projects.reduce((sum, item) => sum + item.members.length, 0)}</span>
          <small>Total members</small>
        </div>
        <div>
          <span>Live</span>
          <small>Collaboration status</small>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <form className="project-form" onSubmit={handleCreateProject}>
            <h3>Create new project</h3>
            <p>Launch a workspace and start inviting collaborators.</p>
            <div className="field">
              <span>Name</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Collaboration Portal"
                required
              />
            </div>
            <div className="field">
              <span>Description</span>
              <input
                className="input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Short summary of the workspace"
              />
            </div>
            <button className="primary-button" type="submit">
              Create project
            </button>
          </form>

          {error ? <div className="form-alert error">{error}</div> : null}

          <div className="project-grid">
            {loading ? (
              <div className="state-card">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="state-card">No projects yet.</div>
            ) : (
              projects.map((project) => {
                const ownerId = project.owner?.id || project.owner?._id;
                const userId = user?.id || user?._id;
                const canInvite =
                  ownerId && userId && String(ownerId) === String(userId);

                return (
                <ProjectCard
                  key={project._id}
                  project={project}
                  canInvite={canInvite}
                  onInvite={(selected) => setActiveProject(selected)}
                />
                );
              })
            )}
          </div>
        </div>

        <aside className="dashboard-aside">
          <div className="aside-card">
            <h3>Member preview</h3>
            {projects[0] ? (
              <MemberListPreview members={projects[0].members} />
            ) : (
              <p>Create a project to invite members.</p>
            )}
          </div>
          <div className="aside-card">
            <h3>Quick actions</h3>
            <div className="quick-actions">
              <button className="secondary-button light" type="button">
                Start a standup
              </button>
              <button className="secondary-button light" type="button">
                Review activity
              </button>
              <button className="secondary-button light" type="button">
                Open AI assistant
              </button>
            </div>
          </div>
        </aside>
      </div>

      <InviteModal
        open={Boolean(activeProject)}
        project={activeProject}
        onClose={() => setActiveProject(null)}
      />
    </section>
  );
};

export default Dashboard;
