import { Link } from "react-router-dom";

import type { Project } from "../types";

type ProjectCardProps = {
  project: Project;
  onInvite?: (project: Project) => void;
  canInvite?: boolean;
};

const ProjectCard = ({ project, onInvite, canInvite }: ProjectCardProps) => {
  const members = project.members?.slice(0, 3) || [];

  return (
    <article className="project-card">
      <div>
        <h3>{project.name}</h3>
        <p>{project.description || "No description yet."}</p>
      </div>
      <div className="project-meta">
        <div className="member-stack">
          {members.map((member) => (
            <span
              key={member.user.id || member.user._id}
              className="member-pill"
            >
              {member.user.name.split(" ")[0]}
            </span>
          ))}
          {project.members.length > members.length ? (
            <span className="member-pill">+{project.members.length - members.length}</span>
          ) : null}
        </div>
        <div className="project-actions">
          <small>Owner: {project.owner?.name}</small>
          <Link className="secondary-button light" to={`/projects/${project._id}`}>
            Open
          </Link>
          {canInvite && onInvite ? (
            <button
              className="secondary-button light"
              type="button"
              onClick={() => onInvite(project)}
            >
              Invite
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
};

export default ProjectCard;
