import { useEffect, useMemo, useState } from "react";

import type { Message, Project } from "../types";
import { getMessages } from "../services/messageService";
import { summarizeChat } from "../services/summaryService";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import FileUploader from "./FileUploader";

const ChatRoom = ({ project }: { project: Project }) => {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const projectId = project._id;

  useEffect(() => {
    const load = async () => {
      const data = await getMessages(projectId);
      setMessages(data.messages.reverse());
    };

    load();
  }, [projectId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.emit("join_room", { projectId });

    const onMessage = (message: Message) => {
      if (message.projectId === projectId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const onTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    };

    const onStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("receive_message", onMessage);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);

    return () => {
      socket.emit("leave_room", { projectId });
      socket.off("receive_message", onMessage);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
    };
  }, [socket, projectId]);

  const handleSend = () => {
    if (!socket || (!content.trim() && attachments.length === 0)) {
      return;
    }

    socket.emit("send_message", {
      projectId,
      content,
      attachments,
    });

    setContent("");
    setAttachments([]);
    socket.emit("stop_typing", { projectId });
  };

  const handleSummarize = async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const data = await summarizeChat(projectId, { limit: 50, store: true });
      setSummary(data.summary);
    } catch (err: any) {
      setSummaryError(err?.response?.data?.message || "Summary failed.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const typingLabel = useMemo(() => {
    const others = typingUsers.filter((id) => id !== user?.id);
    return others.length ? "Someone is typing..." : "";
  }, [typingUsers, user]);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] relative bg-[#050505]">
      {/* Simple Typing Indicator */}
      {typingLabel && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-indigo-400 font-mono bg-indigo-500/10 px-3 py-1 rounded-full">{typingLabel}</div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
             <div className="text-gray-400 font-mono text-base tracking-wide h-full flex items-center mb-20">
                 No messages yet. Start the conversation!
             </div>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.senderId?._id === user?.id || message.senderId?.id === user?.id;
            return (
                <div key={message._id} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/30 flex-shrink-0">
                        {message.senderId?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                        <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className="text-sm font-bold text-gray-300">{message.senderId?.name || "User"}</span>
                            <span className="text-[10px] text-gray-600 font-mono">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-prose ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-[#161b22] text-gray-300 border border-gray-800 rounded-tl-sm'}`}>
                            {message.content}
                        </div>
                    </div>
                </div>
            );  
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-5 border-t border-gray-900 bg-[#050505]">
        <div className="max-w-7xl mx-auto flex items-center gap-3 bg-[#0d1017] border border-gray-800 hover:border-gray-700 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 rounded-lg p-1.5 transition-all shadow-sm">
             <input
                className="flex-1 bg-transparent border-none outline-none text-gray-200 px-4 py-2.5 placeholder-gray-500 font-mono text-sm"
                placeholder="Type a message..."
                value={content}
                onChange={(event) => {
                    setContent(event.target.value);
                    socket?.emit("typing", { projectId });
                }}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                onBlur={() => socket?.emit("stop_typing", { projectId })}
            />
            
            <button 
                onClick={handleSend}
                disabled={!content.trim()}
                className="p-2.5 bg-[#6366f1] hover:bg-[#5558e0] disabled:opacity-50 disabled:hover:bg-[#6366f1] text-white rounded-md transition-colors flex items-center justify-center"
            >
                <svg className="w-4 h-4 transform rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
