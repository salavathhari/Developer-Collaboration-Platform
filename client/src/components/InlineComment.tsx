import { useState, useEffect } from "react";
import { MessageSquare, CheckCircle, XCircle, Edit, Trash2, Reply } from "lucide-react";
import { useSocket } from "../hooks/useSocket";

interface CommentThread {
  _id: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
  resolved: boolean;
  resolvedBy?: {
    _id: string;
    name: string;
  };
  resolvedAt?: string;
  parentCommentId?: string;
  edited?: boolean;
  filePath?: string;
  lineNumber?: number;
}

interface InlineCommentProps {
  prId: string;
  projectId: string;
  filePath: string;
  lineNumber: number;
  currentUserId: string;
  existingComments?: CommentThread[];
  onCommentAdded?: (comment: CommentThread) => void;
  onCommentResolved?: (commentId: string, resolved: boolean) => void;
}

export default function InlineComment({
  prId,
  projectId,
  filePath,
  lineNumber,
  currentUserId,
  existingComments = [],
  onCommentAdded,
  onCommentResolved,
}: InlineCommentProps) {
  const [isOpen, setIsOpen] = useState(existingComments.length > 0);
  const [comments, setComments] = useState<CommentThread[]>(existingComments);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const socket = useSocket(localStorage.getItem("token"));

  useEffect(() => {
    if (socket) {
      // Listen for new comments on this PR
      socket.on("pr:comment_added", (comment: CommentThread) => {
        if (comment.filePath === filePath && comment.lineNumber === lineNumber) {
          setComments((prev) => [...prev, comment]);
          setIsOpen(true);
          onCommentAdded?.(comment);
        }
      });

      // Listen for resolved comments
      socket.on("pr:comment_resolved", ({ commentId, resolved, comment }: any) => {
        setComments((prev) =>
          prev.map((c) =>
            c._id === commentId ? { ...c, resolved, resolvedBy: comment.resolvedBy, resolvedAt: comment.resolvedAt } : c
          )
        );
        onCommentResolved?.(commentId, resolved);
      });

      return () => {
        socket.off("pr:comment_added");
        socket.off("pr:comment_resolved");
      };
    }
  }, [socket, filePath, lineNumber, onCommentAdded, onCommentResolved]);

  const handleAddComment = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Emit via socket for real-time update
      socket?.emit("pr:add_comment", {
        prId,
        filePath,
        lineNumber,
        content: newComment,
        parentCommentId: replyTo,
      });

      setNewComment("");
      setReplyTo(null);
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = (commentId: string, resolved: boolean) => {
    socket?.emit("pr:resolve_comment", {
      prId,
      commentId,
      resolved,
    });
  };

  const threadRootComments = comments.filter((c) => !c.parentCommentId);
  const isResolved = threadRootComments.some((c) => c.resolved);

  if (!isOpen && comments.length === 0) {
    return (
      <div className="inline-flex items-center">
        <button
          onClick={() => setIsOpen(true)}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
          title="Add comment"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`border-l-4 ${isResolved ? "border-green-500" : "border-blue-500"} bg-gray-50 p-3 my-2`}>
      {/* Comment Thread */}
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment._id} className={`${comment.parentCommentId ? "ml-8" : ""}`}>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  {/* Avatar */}
                  {comment.author.avatar ? (
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                      {comment.author.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-sm text-gray-900">
                        {comment.author.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                      {comment.edited && (
                        <span className="text-xs text-gray-400 italic">(edited)</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{comment.content}</p>

                    {/* Resolved indicator */}
                    {comment.resolved && comment.resolvedBy && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>Resolved by {comment.resolvedBy.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setReplyTo(comment._id)}
                    className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                    title="Reply"
                  >
                    <Reply className="w-3 h-3" />
                  </button>
                  
                  {!comment.parentCommentId && (
                    <button
                      onClick={() => handleResolve(comment._id, !comment.resolved)}
                      className={`p-1 rounded ${
                        comment.resolved
                          ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                          : "text-gray-400 hover:text-green-500 hover:bg-green-50"
                      }`}
                      title={comment.resolved ? "Unresolve" : "Resolve"}
                    >
                      {comment.resolved ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply indicator */}
      {replyTo && (
        <div className="mt-2 mb-1 text-xs text-gray-600 flex items-center gap-1">
          <Reply className="w-3 h-3" />
          Replying to thread
        </div>
      )}

      {/* Add comment input */}
      {!isResolved && (
        <div className="mt-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={replyTo ? "Reply to comment..." : "Add a comment..."}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-gray-500">
              {filePath}:{lineNumber}
            </div>
            <div className="flex gap-2">
              {(replyTo || isOpen) && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setNewComment("");
                    setReplyTo(null);
                  }}
                  className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : replyTo ? "Reply" : "Comment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
