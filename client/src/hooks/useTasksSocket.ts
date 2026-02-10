import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Task } from '../types';

interface UseTasksSocketProps {
  projectId: string;
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (data: { task: Task; changedFields: string[] }) => void;
  onTaskMoved?: (data: { taskId: string; task: Task; fromStatus: string; toStatus: string }) => void;
  onTaskDeleted?: (data: { taskId: string }) => void;
  onTaskComment?: (data: { taskId: string; comment: any }) => void;
  onBulkUpdated?: (data: { tasks: Task[] }) => void;
}

export function useTasksSocket({
  projectId,
  onTaskCreated,
  onTaskUpdated,
  onTaskMoved,
  onTaskDeleted,
  onTaskComment,
  onBulkUpdated,
}: UseTasksSocketProps) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;

    // Initialize socket connection
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Join project tasks room
    socket.emit('joinProjectTasks', { projectId });

    // Listen for task events
    if (onTaskCreated) {
      socket.on('task:created', onTaskCreated);
    }

    if (onTaskUpdated) {
      socket.on('task:updated', onTaskUpdated);
    }

    if (onTaskMoved) {
      socket.on('task:moved', onTaskMoved);
    }

    if (onTaskDeleted) {
      socket.on('task:deleted', onTaskDeleted);
    }

    if (onTaskComment) {
      socket.on('task:comment', onTaskComment);
    }

    if (onBulkUpdated) {
      socket.on('task:bulk_updated', onBulkUpdated);
    }

    // Error handling
    socket.on('error', (error) => {
      console.error('Task socket error:', error);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Cleanup
    return () => {
      socket.emit('leaveProjectTasks', { projectId });
      socket.off('task:created');
      socket.off('task:updated');
      socket.off('task:moved');
      socket.off('task:deleted');
      socket.off('task:comment');
      socket.off('task:bulk_updated');
      socket.off('error');
      socket.off('connect_error');
      socket.close();
    };
  }, [projectId, onTaskCreated, onTaskUpdated, onTaskMoved, onTaskDeleted, onTaskComment, onBulkUpdated]);

  // Utility methods to emit events
  const moveTask = (taskId: string, toStatus: string, toOrderKey?: number) => {
    if (socketRef.current) {
      socketRef.current.emit('task:move', { taskId, toStatus, toOrderKey });
    }
  };

  const quickAssignSelf = (taskId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('task:quick_assign', { taskId });
    }
  };

  const startTyping = (taskId: string, userName: string) => {
    if (socketRef.current) {
      socketRef.current.emit('task:typing', { taskId, userName });
    }
  };

  const stopTyping = (taskId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('task:stop_typing', { taskId });
    }
  };

  return {
    socket: socketRef.current,
    moveTask,
    quickAssignSelf,
    startTyping,
    stopTyping,
  };
}
