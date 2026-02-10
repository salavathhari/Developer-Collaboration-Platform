import React, { useState } from "react";
import { uploadFile, UploadFileParams } from "../services/attachmentService";

interface AttachmentUploaderProps {
  projectId: string;
  relatedTask?: string;
  relatedPR?: string;
  relatedChatMessage?: string;
  visibility?: "project" | "private";
  onUploadComplete?: (attachment: any) => void;
  onUploadError?: (error: string) => void;
  multiple?: boolean;
  maxSizeMB?: number;
  className?: string;
}

const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  projectId,
  relatedTask,
  relatedPR,
  relatedChatMessage,
  visibility = "project",
  onUploadComplete,
  onUploadError,
  multiple = false,
  maxSizeMB = 10,
  className = "",
}) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0]; // For now, handle one file at a time

    // Validate file size
    if (file.size > maxSizeBytes) {
      const error = `File size exceeds ${maxSizeMB}MB limit`;
      onUploadError?.(error);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const params: UploadFileParams = {
        file,
        projectId,
        visibility,
      };

      if (relatedTask) params.relatedTask = relatedTask;
      if (relatedPR) params.relatedPR = relatedPR;
      if (relatedChatMessage) params.relatedChatMessage = relatedChatMessage;

      // Simulate progress (since we can't track actual upload progress easily with fetch)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const attachment = await uploadFile(params);

      clearInterval(progressInterval);
      setProgress(100);

      onUploadComplete?.(attachment);

      // Reset after success
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 1000);
    } catch (error: any) {
      console.error("Upload error:", error);
      onUploadError?.(error.response?.data?.message || error.message);
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className={`file-uploader ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {uploading ? (
          <div>
            <div className="mb-3">
              <svg
                className="animate-spin h-10 w-10 text-blue-500 mx-auto"
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
            <p className="text-gray-600">Uploading... {progress}%</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <>
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="mt-4">
              <label
                htmlFor="attachment-upload"
                className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md inline-block transition-colors"
              >
                Choose File
              </label>
              <input
                id="attachment-upload"
                name="attachment-upload"
                type="file"
                className="sr-only"
                onChange={(e) => handleFileSelect(e.target.files)}
                multiple={multiple}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">or drag and drop</p>
            <p className="text-xs text-gray-400 mt-1">Max {maxSizeMB}MB</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AttachmentUploader;
