# Integration Examples for File Attachments

This document shows how to integrate the file attachment system into existing components.

## 1. Task Detail Integration

Add file attachments to task details:

```tsx
// In TaskModal.tsx or TaskDetail.tsx
import { useState, useEffect } from 'react';
import AttachmentUploader from './AttachmentUploader';
import FileList from './FileList';
import { getProjectFiles, Attachment } from '../services/attachmentService';
import { useSocket } from '../hooks/useSocket';

const TaskDetail = ({ task, projectId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  // Load task attachments
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const files = await getProjectFiles({
          projectId,
          context: 'task',
          contextId: task._id,
        });
        setAttachments(files);
      } catch (error) {
        console.error('Failed to load attachments:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttachments();
  }, [projectId, task._id]);

  // Listen for real-time file uploads
  useEffect(() => {
    if (!socket) return;

    const handleFileUploaded = (data: any) => {
      if (data.relatedTask === task._id) {
        setAttachments(prev => [data, ...prev]);
      }
    };

    const handleFileDeleted = (data: any) => {
      setAttachments(prev => prev.filter(f => f._id !== data.fileId));
    };

    socket.on('file:uploaded', handleFileUploaded);
    socket.on('file:deleted', handleFileDeleted);

    return () => {
      socket.off('file:uploaded', handleFileUploaded);
      socket.off('file:deleted', handleFileDeleted);
    };
  }, [socket, task._id]);

  const handleUploadComplete = (attachment: Attachment) => {
    setAttachments(prev => [attachment, ...prev]);
  };

  const handleFileDeleted = (fileId: string) => {
    setAttachments(prev => prev.filter(f => f._id !== fileId));
  };

  return (
    <div className="task-detail">
      {/* ... existing task content ... */}
      
      {/* Attachments Section */}
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-semibold mb-4">Attachments</h3>
        
        {/* Upload Area */}
        <AttachmentUploader
          projectId={projectId}
          relatedTask={task._id}
          onUploadComplete={handleUploadComplete}
          onUploadError={(error) => alert(error)}
          className="mb-4"
        />
        
        {/* File List */}
        {loading ? (
          <div className="text-center py-4">Loading attachments...</div>
        ) : (
          <FileList
            files={attachments}
            onFileDeleted={handleFileDeleted}
            allowDelete={true}
          />
        )}
      </div>
    </div>
  );
};

export default TaskDetail;
```

## 2. Pull Request Detail Integration

Add attachments to PR discussions:

```tsx
// In PRDetail.tsx
import { useState, useEffect } from 'react';
import AttachmentUploader from './AttachmentUploader';
import FileList from './FileList';
import { getProjectFiles, Attachment } from '../services/attachmentService';
import { useSocket } from '../hooks/useSocket';

const PRDetail = ({ pullRequest, projectId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUploader, setShowUploader] = useState(false);
  const socket = useSocket();

  useEffect(() => {
    const loadAttachments = async () => {
      try {
        const files = await getProjectFiles({
          projectId,
          context: 'pr',
          contextId: pullRequest._id,
        });
        setAttachments(files);
      } catch (error) {
        console.error('Failed to load PR attachments:', error);
      }
    };

    loadAttachments();
  }, [projectId, pullRequest._id]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleFileUploaded = (data: any) => {
      if (data.relatedPR === pullRequest._id) {
        setAttachments(prev => [data, ...prev]);
      }
    };

    socket.on('file:uploaded', handleFileUploaded);
    return () => socket.off('file:uploaded', handleFileUploaded);
  }, [socket, pullRequest._id]);

  return (
    <div className="pr-detail">
      {/* ... existing PR content ... */}
      
      {/* Attachments Tab or Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Attachments ({attachments.length})
          </h3>
          <button
            onClick={() => setShowUploader(!showUploader)}
            className="text-blue-500 hover:text-blue-600"
          >
            {showUploader ? 'Hide Uploader' : '+ Add Files'}
          </button>
        </div>
        
        {showUploader && (
          <AttachmentUploader
            projectId={projectId}
            relatedPR={pullRequest._id}
            onUploadComplete={(attachment) => {
              setAttachments(prev => [attachment, ...prev]);
              setShowUploader(false);
            }}
            className="mb-4"
          />
        )}
        
        <FileList
          files={attachments}
          onFileDeleted={(id) => setAttachments(prev => prev.filter(f => f._id !== id))}
          allowDelete={true}
        />
      </div>
    </div>
  );
};

export default PRDetail;
```

## 3. Chat Message Integration

Add inline file attachments to chat messages:

```tsx
// In ChatRoom.tsx
import { useState } from 'react';
import AttachmentUploader from './AttachmentUploader';
import FileList from './FileList';
import FilePickerModal from './FilePickerModal';
import { Attachment } from '../services/attachmentService';

const ChatRoom = ({ projectId, roomId }) => {
  const [message, setMessage] = useState('');
  const [attachingFile, setAttachingFile] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const sendMessage = async () => {
    if (!message.trim() && !pendingAttachment) return;

    try {
      // Send message with attachment reference
      const messageData = {
        content: message,
        attachmentId: pendingAttachment?._id,
      };

      await sendChatMessage(projectId, roomId, messageData);
      
      setMessage('');
      setPendingAttachment(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleFileUpload = (attachment: Attachment) => {
    setPendingAttachment(attachment);
    setAttachingFile(false);
  };

  const handleFileSelect = (file: Attachment) => {
    setPendingAttachment(file);
    setShowFilePicker(false);
  };

  return (
    <div className="chat-room">
      {/* ... existing chat messages ... */}
      
      {/* Message Input */}
      <div className="chat-input border-t p-4">
        {/* Pending Attachment Preview */}
        {pendingAttachment && (
          <div className="mb-2 p-2 bg-blue-50 rounded flex items-center justify-between">
            <span className="text-sm">
              📎 {pendingAttachment.name}
            </span>
            <button
              onClick={() => setPendingAttachment(null)}
              className="text-red-500 hover:text-red-600"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* Upload Area (conditional) */}
        {attachingFile && (
          <div className="mb-2">
            <AttachmentUploader
              projectId={projectId}
              relatedChatMessage={null} // Will be set after message is created
              onUploadComplete={handleFileUpload}
              onUploadError={(error) => {
                alert(error);
                setAttachingFile(false);
              }}
            />
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          {/* Attach File Button */}
          <button
            onClick={() => setAttachingFile(!attachingFile)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Upload new file"
          >
            📤
          </button>
          
          {/* Pick Existing File Button */}
          <button
            onClick={() => setShowFilePicker(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Choose existing file"
          >
            📁
          </button>
          
          {/* Message Input */}
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          {/* Send Button */}
          <button
            onClick={sendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
      
      {/* File Picker Modal */}
      {showFilePicker && (
        <FilePickerModal
          projectId={projectId}
          onFileSelect={handleFileSelect}
          onClose={() => setShowFilePicker(false)}
        />
      )}
    </div>
  );
};

export default ChatRoom;
```

## 4. Displaying Attachments in Chat Messages

Render attachments within chat messages:

```tsx
// In ChatMessage.tsx component
import { Attachment } from '../services/attachmentService';
import { useState } from 'react';
import FilePreview from './FilePreview';

interface Message {
  _id: string;
  content: string;
  sender: { name: string; avatar?: string };
  attachment?: Attachment;
  createdAt: string;
}

const ChatMessage = ({ message }: { message: Message }) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="chat-message p-3 hover:bg-gray-50">
      <div className="flex items-start space-x-3">
        <img
          src={message.sender.avatar || '/default-avatar.png'}
          alt={message.sender.name}
          className="w-10 h-10 rounded-full"
        />
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">{message.sender.name}</span>
            <span className="text-xs text-gray-500">
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
          </div>
          
          {message.content && (
            <p className="mt-1 text-gray-800">{message.content}</p>
          )}
          
          {/* Attachment */}
          {message.attachment && (
            <div
              onClick={() => setShowPreview(true)}
              className="mt-2 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 max-w-sm"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">
                  {message.attachment.mimeType.startsWith('image/') ? '🖼️' : '📄'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {message.attachment.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(message.attachment.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <a
                  href={message.attachment.url}
                  download={message.attachment.name}
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                >
                  ⬇️
                </a>
              </div>
              
              {/* Image Preview */}
              {message.attachment.mimeType.startsWith('image/') && (
                <img
                  src={message.attachment.url}
                  alt={message.attachment.name}
                  className="mt-2 rounded max-h-48 object-cover w-full"
                />
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Full Preview Modal */}
      {showPreview && message.attachment && (
        <FilePreview
          file={message.attachment}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};

export default ChatMessage;
```

## 5. Project Files Dashboard

Create a dedicated files view for the project:

```tsx
// In ProjectWorkspace.tsx or FilesHub.tsx
import { useState, useEffect } from 'react';
import AttachmentUploader from './AttachmentUploader';
import FileList from './FileList';
import { getProjectFiles, Attachment } from '../services/attachmentService';

const FilesHub = ({ projectId }) => {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [filter, setFilter] = useState<'all' | 'task' | 'pr' | 'chat'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true);
        const fetchedFiles = await getProjectFiles({ projectId });
        setFiles(fetchedFiles);
      } catch (error) {
        console.error('Failed to load files:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [projectId]);

  const filteredFiles = files.filter(file => {
    if (filter === 'all') return true;
    if (filter === 'task') return file.relatedTask;
    if (filter === 'pr') return file.relatedPR;
    if (filter === 'chat') return file.relatedChatMessage;
    return true;
  });

  const stats = {
    total: files.length,
    tasks: files.filter(f => f.relatedTask).length,
    prs: files.filter(f => f.relatedPR).length,
    chats: files.filter(f => f.relatedChatMessage).length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
  };

  return (
    <div className="files-hub p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Project Files</h1>
        <p className="text-gray-600">
          Manage and view all files attached to this project
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">Total Files</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">Task Files</p>
          <p className="text-2xl font-bold">{stats.tasks}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">PR Files</p>
          <p className="text-2xl font-bold">{stats.prs}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <p className="text-sm text-gray-500">Total Size</p>
          <p className="text-2xl font-bold">
            {(stats.totalSize / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="mb-6 bg-white p-6 rounded-lg border">
        <h2 className="text-lg font-semibold mb-4">Upload Files</h2>
        <AttachmentUploader
          projectId={projectId}
          onUploadComplete={(attachment) => setFiles(prev => [attachment, ...prev])}
          onUploadError={(error) => alert(error)}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-4 mb-4 border-b">
        {['all', 'task', 'pr', 'chat'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab as any)}
            className={`px-4 py-2 border-b-2 transition-colors ${
              filter === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* File List */}
      {loading ? (
        <div className="text-center py-8">Loading files...</div>
      ) : (
        <FileList
          files={filteredFiles}
          onFileDeleted={(id) => setFiles(prev => prev.filter(f => f._id !== id))}
          showContext={true}
          allowDelete={true}
        />
      )}
    </div>
  );
};

export default FilesHub;
```

## 6. Socket.io Setup

Ensure socket connection with file event listeners:

```tsx
// In useSocket.ts hook or socket context
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export const useSocket = (projectId?: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5000', {
      auth: {
        token: localStorage.getItem('token'),
      },
    });

    setSocket(newSocket);

    // Join project room
    if (projectId) {
      newSocket.emit('join:project', { projectId });
    }

    return () => {
      newSocket.disconnect();
    };
  }, [projectId]);

  return socket;
};
```

## Quick Start Checklist

1. ✅ Install dependencies: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer firebase-admin`
2. ✅ Configure environment variables (see `.env.storage.example`)
3. ✅ Set up S3 bucket or Firebase Storage
4. ✅ Import `AttachmentUploader` and `FileList` components
5. ✅ Add attachment sections to Task/PR/Chat components
6. ✅ Set up socket listeners for real-time updates
7. ✅ Test file upload, download, and deletion

## Tips

- Always validate project membership before showing upload button
- Use `FilePickerModal` to let users attach existing files
- Display file count badges on tabs/sections
- Show loading states during uploads
- Handle errors gracefully with user-friendly messages
- Implement optimistic UI updates for better UX
