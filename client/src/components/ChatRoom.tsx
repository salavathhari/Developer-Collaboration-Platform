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
    <div className="chat-room">
      <div className="chat-header">
        <h3>Project Chat</h3>
        <span>{typingLabel}</span>
        <button
          className="secondary-button light"
          type="button"
          onClick={handleSummarize}
          disabled={summaryLoading}
        >
          {summaryLoading ? "Summarizing..." : "Summarize"}
        </button>
      </div>

      {summaryError ? <div className="form-alert error">{summaryError}</div> : null}
      {summary ? (
        <div className="chat-summary">
          <strong>Summary</strong>
          <p>{summary}</p>
        </div>
      ) : null}

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message._id} className="chat-message">
            <div className="chat-avatar">
              {message.senderId?.avatar ? (
                <img src={message.senderId.avatar} alt={message.senderId.name} />
              ) : (
                <span>{message.senderId?.name?.[0] || "U"}</span>
              )}
            </div>
            <div className="chat-bubble">
              <div className="chat-meta">
                <strong>{message.senderId?.name || "User"}</strong>
                <small>{new Date(message.createdAt).toLocaleTimeString()}</small>
              </div>
              <p>{message.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          className="input"
          placeholder="Type a message"
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            socket?.emit("typing", { projectId });
          }}
          onBlur={() => socket?.emit("stop_typing", { projectId })}
        />
        <FileUploader
          projectId={projectId}
          onUploaded={(file) => setAttachments((prev) => [...prev, file._id])}
        />
        <button className="primary-button" type="button" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;
