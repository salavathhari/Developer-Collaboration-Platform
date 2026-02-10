import React, { useState, useEffect } from "react";
import { Attachment, getFile, isPreviewable } from "../services/attachmentService";

interface FilePreviewProps {
  file: Attachment;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      try {
        setLoading(true);
        const fileWithUrl = await getFile(file._id);
        setSignedUrl(fileWithUrl.signedUrl || fileWithUrl.url);
      } catch (err: any) {
        console.error("Error fetching signed URL:", err);
        setError(err.response?.data?.message || "Failed to load file");
      } finally {
        setLoading(false);
      }
    };

    if (isPreviewable(file.mimeType)) {
      fetchSignedUrl();
    } else {
      setLoading(false);
    }
  }, [file._id, file.mimeType]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <svg
            className="animate-spin h-10 w-10 text-blue-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-600">
          <p>{error}</p>
        </div>
      );
    }

    if (!isPreviewable(file.mimeType)) {
      return (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-16 w-16 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-gray-600">Preview not available for this file type</p>
          <a
            href={file.url}
            download={file.name}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Download File
          </a>
        </div>
      );
    }

    if (file.mimeType.startsWith("image/")) {
      return (
        <img
          src={signedUrl || file.url}
          alt={file.name}
          className="max-w-full max-h-[70vh] mx-auto object-contain"
        />
      );
    }

    if (file.mimeType === "application/pdf") {
      return (
        <iframe
          src={signedUrl || file.url}
          title={file.name}
          className="w-full h-[70vh] border-0"
        />
      );
    }

    if (file.mimeType.startsWith("text/") || file.mimeType === "application/json") {
      return (
        <iframe
          src={signedUrl || file.url}
          title={file.name}
          className="w-full h-[70vh] border border-gray-300 rounded"
        />
      );
    }

    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Preview not implemented for this file type</p>
        <a
          href={file.url}
          download={file.name}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          Download File
        </a>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{file.name}</h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
              <span>{file.uploadedBy.name}</span>
              <span>•</span>
              <span>{new Date(file.createdAt).toLocaleDateString()}</span>
              {file.version > 1 && (
                <>
                  <span>•</span>
                  <span className="text-blue-600">Version {file.version}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <a
              href={signedUrl || file.url}
              download={file.name}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Download"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </a>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">{renderPreview()}</div>

        {/* Footer with metadata */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Size</p>
              <p className="text-gray-900 font-medium">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <p className="text-gray-900 font-medium">{file.mimeType}</p>
            </div>
            <div>
              <p className="text-gray-500">Visibility</p>
              <p className="text-gray-900 font-medium capitalize">{file.visibility}</p>
            </div>
            <div>
              <p className="text-gray-500">Context</p>
              <p className="text-gray-900 font-medium">
                {file.relatedTask && "Task"}
                {file.relatedPR && "Pull Request"}
                {file.relatedChatMessage && "Chat"}
                {!file.relatedTask && !file.relatedPR && !file.relatedChatMessage && "Project"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;
