import { useEffect, useState, useRef } from "react";
import { Send, Smile, Paperclip, X, Reply, Hash, Users } from "lucide-react";
import { useSocket } from "../hooks/useSocket";
import { getChatHistory, sendChatMessage, markMessagesAsRead } from "../services/messageService";

interface Message {
  _id: string;
  authorId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  replyTo?: string;
  readBy?: string[];
}

interface ChatSidebarProps {
  projectId: string;
  roomType: "project" | "pr" | "file";
  roomId: string;
  currentUserId: string;
}

export default function ChatSidebar({ projectId, roomType, roomId, currentUserId }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socket = useSocket(localStorage.getItem("token"));

  const roomName = `chat:${projectId}:${roomType}:${roomId}`;

  useEffect(() => {
    loadMessages();
    
    if (socket) {
      // Join chat room
      socket.emit("chat:join_room", { projectId, roomType, roomId });

      // Listen for new messages
      socket.on("chat:new_message", (message: Message) => {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      });

      // Listen for typing indicators
      socket.on("chat:user_typing", ({ userId }: { userId: string }) => {
        setTypingUsers((prev) => new Set(prev).add(userId));
      });

      socket.on("chat:user_stopped_typing", ({ userId }: { userId: string }) => {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
      });

      // Listen for read receipts
      socket.on("chat:messages_read", ({ userId, messageIds }: { userId: string; messageIds: string[] }) => {
        setMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg._id)
              ? { ...msg, readBy: [...(msg.readBy || []), userId] }
              : msg
          )
        );
      });
    }

    return () => {
      if (socket) {
        socket.emit("chat:leave_room", { projectId, roomType, roomId });
        socket.off("chat:new_message");
        socket.off("chat:user_typing");
        socket.off("chat:user_stopped_typing");
        socket.off("chat:messages_read");
      }
    };
  }, [socket, projectId, roomType, roomId]);

  useEffect(() => {
    scrollToBottom();
    markVisibleMessagesAsRead();
  }, [messages]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const history = await getChatHistory(projectId, roomType, roomId, 50);
      setMessages(history);
    } catch (error) {
      console.error("Failed to load chat history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const markVisibleMessagesAsRead = async () => {
    const unreadMessages = messages
      .filter((msg) => msg.authorId._id !== currentUserId && !msg.readBy?.includes(currentUserId))
      .map((msg) => msg._id);

    if (unreadMessages.length > 0) {
      try {
        await markMessagesAsRead(projectId, roomType, roomId, unreadMessages);
        socket?.emit("chat:mark_read", { projectId, roomType, roomId, messageIds: unreadMessages });
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const message = await sendChatMessage(projectId, roomType, roomId, newMessage, replyTo?._id);
      
      // Also emit via socket for real-time delivery
      socket?.emit("chat:send_message", {
        projectId,
        roomType,
        roomId,
        text: newMessage,
        replyTo: replyTo?._id,
      });

      setNewMessage("");
      setReplyTo(null);
      socket?.emit("chat:stop_typing", { projectId, roomType, roomId });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleTyping = () => {
    socket?.emit("chat:typing", { projectId, roomType, roomId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit("chat:stop_typing", { projectId, roomType, roomId });
    }, 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getRoomIcon = () => {
    switch (roomType) {
      case "project":
        return <Hash className="w-4 h-4" />;
      case "pr":
        return <Users className="w-4 h-4" />;
      case "file":
        return <Paperclip className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getRoomLabel = () => {
    switch (roomType) {
      case "project":
        return "Project Chat";
      case "pr":
        return `PR #${roomId}`;
      case "file":
        return `File: ${roomId.split("/").pop()}`;
      default:
        return "Chat";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        {getRoomIcon()}
        <h3 className="font-semibold text-gray-900">{getRoomLabel()}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Users className="w-12 h-12 mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message._id} className="group">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {message.authorId.avatar ? (
                    <img
                      src={message.authorId.avatar}
                      alt={message.authorId.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                      {message.authorId.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm text-gray-900">
                      {message.authorId.name}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-1 break-words whitespace-pre-wrap">
                    {message.text}
                  </p>

                  {/* Read receipts */}
                  {message.authorId._id === currentUserId && message.readBy && message.readBy.length > 1 && (
                    <div className="text-xs text-gray-400 mt-1">
                      Read by {message.readBy.length - 1}
                    </div>
                  )}
                </div>

                {/* Reply button (on hover) */}
                <button
                  onClick={() => setReplyTo(message)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded transition-opacity"
                  title="Reply"
                >
                  <Reply className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <div className="px-4 py-2 text-xs text-gray-500">
          <span className="inline-flex gap-1">
            <span className="animate-bounce">•</span>
            <span className="animate-bounce delay-100">•</span>
            <span className="animate-bounce delay-200">•</span>
            <span className="ml-2">Someone is typing...</span>
          </span>
        </div>
      )}

      {/* Reply indicator */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Reply className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">
              Replying to <span className="font-semibold">{replyTo.authorId.name}</span>
            </span>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={handleKeyPress}
              placeholder={`Message ${getRoomLabel()}...`}
              rows={1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              style={{ minHeight: "40px", maxHeight: "120px" }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
