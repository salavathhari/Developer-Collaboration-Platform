import type { User } from "../types";

type PresenceBarProps = {
  members: User[];
  onlineUserIds: string[];
};

const PresenceBar = ({ members, onlineUserIds }: PresenceBarProps) => {
  const onlineSet = new Set(onlineUserIds);

  if (members.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-6 py-2 bg-[#0d1017] border-b border-gray-800">
      {members.map((member) => {
        const id = member.id || member._id || "";
        const isOnline = onlineSet.has(id);
        const name = member.name.split(" ")[0];
        
        return (
          <div 
            key={id} 
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                isOnline 
                ? "bg-green-500/10 border-green-500/20 text-green-400" 
                : "bg-gray-800/50 border-gray-700 text-gray-500"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" : "bg-gray-500"}`} />
            {name}
          </div>
        );
      })}
    </div>
  );
};

export default PresenceBar;
