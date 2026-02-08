import { useEffect, useMemo, useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";

import type { Message, Project } from "../types";
import { getMessages } from "../services/messageService";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";
import VideoCall from "./VideoCall";
import PresenceBar from "./PresenceBar";

const ChatRoom = ({ project }: { project: Project }) => {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const projectId = project._id;
  const ownerId = project.owner._id || project.owner; 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const load = async () => {
      const data = await getMessages(projectId);
      setMessages(data.messages.reverse());
      scrollToBottom();
    };
    load();
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_room", { projectId });

    const onMessage = (message: Message) => {
      if (message.projectId === projectId) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const onTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => prev.includes(userId) ? prev : [...prev, userId]);
    };

    const onStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    };

    const onPresenceUpdate = ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
        setOnlineUserIds(ids);
    };

    socket.on("receive_message", onMessage);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("presence_update", onPresenceUpdate);

    return () => {
      socket.emit("leave_room", { projectId });
      socket.off("receive_message", onMessage);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("presence_update", onPresenceUpdate);
    };
  }, [socket, projectId]);

  const handleSend = () => {
    if (!socket || (!content.trim() && attachments.length === 0)) return;

    socket.emit("send_message", {
      projectId,
      content,
      attachments,
    });

    setContent("");
    setAttachments([]);
    socket.emit("stop_typing", { projectId });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    if(socket) {
        if (e.target.value.length > 0) socket.emit("typing", { projectId });
        else socket.emit("stop_typing", { projectId });
    }
  };

  const typingLabel = useMemo(() => {
    const others = typingUsers.filter((id) => id !== user?.id);
    if (others.length === 0) return "";
    
    const names = others.map(id => {
       const member = project.members.find(m => (m.user.id || m.user._id) === id);
       return member ? member.user.name.split(" ")[0] : "Someone";
    });

    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return `${names.length} people are typing...`;
  }, [typingUsers, user, project.members]);

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] relative bg-[#050505] rounded-xl border border-gray-800 shadow-2xl overflow-hidden">
      <VideoCall projectId={projectId} ownerId={typeof ownerId === 'string' ? ownerId : (ownerId as any)?.id || (ownerId as any)?._id} />
      
      <PresenceBar 
        members={project.members.map(m => m.user)} 
        onlineUserIds={onlineUserIds} 
      />

      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent flex flex-col gap-4 bg-[#050505]">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
             <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             <p className="font-mono text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.senderId?._id === user?.id || msg.senderId?.id === user?.id;
            const showAvatar = i === 0 || (messages[i - 1].senderId?._id || messages[i - 1].senderId?.id) !== (msg.senderId?._id || msg.senderId?.id);
            const SenderName = msg.senderId?.name || "User";
            const Initials = SenderName.charAt(0).toUpperCase();

            return (
                <div key={msg._id || i} className={`group flex items-end gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className="w-8 flex-shrink-0">
                        {showAvatar && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                                {Initials}
                            </div>
                        )}
                    </div>
                    
                    {/* Bubble */}
                    <div className={`flex flex-col max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                        {showAvatar && !isMe && (
                            <span className="text-[10px] text-gray-500 ml-1 mb-1">{SenderName}</span>
                        )}
                        <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isMe 
                            ? "bg-indigo-600 text-white rounded-br-none" 
                            : "bg-[#1e293b] text-gray-200 border border-gray-800 rounded-bl-none"
                        }`}>
                            {msg.content}
                        </div>
                        <span className="text-[10px] text-gray-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </span>
                    </div>
                </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-[#0d1017] border-t border-gray-800">
        {typingLabel && (
             <div className="text-xs text-indigo-400 font-mono mb-2 ml-2 animate-pulse flex items-center gap-1">
                 <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                 <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                 <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                 <span className="ml-1">{typingLabel}</span>
             </div>
        )}
        
        <div className="flex items-center gap-3 bg-[#050505] border border-gray-800 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 rounded-lg p-1.5 transition-all shadow-input">
             <input
                className="flex-1 bg-transparent border-none outline-none text-gray-200 px-4 py-2.5 placeholder-gray-600 font-mono text-sm"
                placeholder="Type a message..."
                value={content}
                onChange={handleTyping}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                onBlur={() => socket?.emit("stop_typing", { projectId })}
            />
            
            <button 
                onClick={handleSend}
                disabled={!content.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-md transition-all flex items-center justify-center shadow-lg shadow-indigo-900/20"
            >
                <svg className="w-4 h-4 transform rotate-45 translate-x-px translate-y-px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
