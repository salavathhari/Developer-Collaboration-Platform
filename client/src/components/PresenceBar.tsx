import type { User } from "../types";

type PresenceBarProps = {
  members: User[];
  onlineUserIds: string[];
};

const PresenceBar = ({ members, onlineUserIds }: PresenceBarProps) => {
  const onlineSet = new Set(onlineUserIds);

  return (
    <div className="presence-bar">
      {members.map((member) => {
        const id = member.id || member._id || "";
        const isOnline = onlineSet.has(id);
        return (
          <div key={id} className="presence-avatar">
            <span className={isOnline ? "dot online" : "dot offline"} />
            <div className="avatar-text">
              {member.name.split(" ")[0]}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PresenceBar;
