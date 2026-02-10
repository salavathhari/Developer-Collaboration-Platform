import { useEffect, useState } from "react";
import { Users, FileCode } from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import type { User } from "../types";

interface PresenceUser {
  userId: User;
  status: "active" | "away" | "busy";
  currentFile?: string;
  currentLine?: number;
  lastActivity: string;
}

type PresenceBarProps = {
  members: User[];
  onlineUserIds: string[];
  projectId?: string;
  currentUserId?: string;
  onUserClick?: (userId: string, filePath?: string, line?: number) => void;
  enhanced?: boolean; // Toggle between simple and enhanced mode
};

const PresenceBar = ({
  members,
  onlineUserIds,
  projectId,
  currentUserId,
  onUserClick,
  enhanced = false,
}: PresenceBarProps) => {
  const [presence, setPresence] = useState<Map<string, PresenceUser>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const socket = useSocket(localStorage.getItem("token"));
  const onlineSet = new Set(onlineUserIds);

  useEffect(() => {
    if (!enhanced || !socket || !projectId) return;

    socket.on("presence:status_changed", ({ userId, status }) => {
      setPresence((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(userId);
        if (existing) {
          newMap.set(userId, { ...existing, status });
        }
        return newMap;
      });
    });

    socket.on("review:cursor_update", ({ userId, filePath, lineNumber }) => {
      setPresence((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(userId);
        if (existing) {
          newMap.set(userId, {
            ...existing,
            currentFile: filePath,
            currentLine: lineNumber,
          });
        }
        return newMap;
      });
    });

    return () => {
      socket.off("presence:status_changed");
      socket.off("review:cursor_update");
    };
  }, [socket, enhanced, projectId]);

  if (members.length === 0) return null;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "busy":
        return "bg-red-500";
      case "away":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  // Simple mode (original)
  if (!enhanced) {
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
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline ? "bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" : "bg-gray-500"
                }`}
              />
              {name}
            </div>
          );
        })}
      </div>
    );
  }

  // Enhanced mode with detailed presence
  const onlineMembers = members.filter((m) => onlineSet.has(m.id || m._id || ""));
  const otherUsers = onlineMembers.filter((m) => (m.id || m._id) !== currentUserId);

  if (otherUsers.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <Users className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500">No one else is online</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:bg-gray-100 rounded px-2 py-1 transition-colors"
        >
          <Users className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            {otherUsers.length} {otherUsers.length === 1 ? "person" : "people"} online
          </span>
        </button>

        {/* Avatar stack */}
        <div className="flex -space-x-2">
          {otherUsers.slice(0, 5).map((user) => {
            const userId = user.id || user._id || "";
            const userPresence = presence.get(userId);
            return (
              <div key={userId} className="relative" title={user.name}>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full border-2 border-white"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${getStatusColor(
                    userPresence?.status
                  )}`}
                ></div>
              </div>
            );
          })}
          {otherUsers.length > 5 && (
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs font-semibold text-gray-600">
              +{otherUsers.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* Expanded list */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
          {otherUsers.map((user) => {
            const userId = user.id || user._id || "";
            const userPresence = presence.get(userId);
            return (
              <div
                key={userId}
                className="flex items-start justify-between bg-white rounded-lg p-2 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-shrink-0">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div
                      className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(
                        userPresence?.status
                      )}`}
                    ></div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm text-gray-900 truncate">{user.name}</span>

                    {userPresence?.currentFile && (
                      <button
                        onClick={() =>
                          onUserClick?.(userId, userPresence.currentFile, userPresence.currentLine)
                        }
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-1"
                      >
                        <FileCode className="w-3 h-3" />
                        <span className="truncate">
                          {userPresence.currentFile.split("/").pop()}
                          {userPresence.currentLine && `:${userPresence.currentLine}`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PresenceBar;

