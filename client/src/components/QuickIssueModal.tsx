import { useState } from "react";
import { X, AlertCircle, Link as LinkIcon } from "lucide-react";
import api from "../services/api";

interface QuickIssueModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated?: (issue: any) => void;
  // Context from which issue is created
  context?: {
    prId?: string;
    filePath?: string;
    lineNumber?: number;
    chatMessageId?: string;
    reviewCommentId?: string;
    taskId?: string;
  };
}

export default function QuickIssueModal({
  projectId,
  isOpen,
  onClose,
  onIssueCreated,
  context,
}: QuickIssueModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post("/api/issues", {
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        ...context, // Include context (prId, filePath, etc.)
      });

      onIssueCreated?.(response.data);
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setError("");
    onClose();
  };

  const getContextLabel = () => {
    if (context?.prId) return `PR #${context.prId}`;
    if (context?.filePath) return `File: ${context.filePath.split("/").pop()}`;
    if (context?.chatMessageId) return "Chat Message";
    if (context?.reviewCommentId) return "Review Comment";
    if (context?.taskId) return "Task";
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Issue</h2>
            {getContextLabel() && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                <LinkIcon className="w-3 h-3" />
                <span>Linked to: {getContextLabel()}</span>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="issue-title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="issue-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              maxLength={200}
            />
            <p className="text-xs text-gray-500 mt-1">{title.length}/200 characters</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="issue-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="issue-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more details about the issue, steps to reproduce, expected behavior, etc."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Priority */}
          <div>
            <label htmlFor="issue-priority" className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["low", "medium", "high", "critical"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPriority(level)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    priority === level
                      ? level === "critical"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : level === "high"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : level === "medium"
                        ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                        : "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Context preview */}
          {context && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Linked Context</h4>
              <div className="text-xs text-blue-700 space-y-1">
                {context.prId && <p>Pull Request: #{context.prId}</p>}
                {context.filePath && (
                  <p>
                    File: {context.filePath}
                    {context.lineNumber && ` (line ${context.lineNumber})`}
                  </p>
                )}
                {context.chatMessageId && <p>Chat Message ID: {context.chatMessageId}</p>}
                {context.reviewCommentId && <p>Review Comment ID: {context.reviewCommentId}</p>}
                {context.taskId && <p>Related Task ID: {context.taskId}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Creating...
                </>
              ) : (
                "Create Issue"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
