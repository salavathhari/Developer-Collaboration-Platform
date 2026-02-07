import type { ProjectMember } from "../types";

const MemberListPreview = ({ members }: { members: ProjectMember[] }) => {
  return (
    <div className="member-preview">
      <h4>Members</h4>
      <ul>
        {members.slice(0, 4).map((member) => (
          <li key={member.user.id || member.user._id}>
            <span>{member.user.name}</span>
            <small>{member.role}</small>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MemberListPreview;
