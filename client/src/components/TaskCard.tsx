import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Calendar, MessageSquare, Paperclip, GitPullRequest, AlertCircle } from 'lucide-react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index, onClick }) => {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-500/50';
      case 'high':
        return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <Draggable draggableId={task._id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          style={{ ...provided.draggableProps.style }}
          className={`
            bg-white dark:bg-[#0d1117] p-3 rounded-lg border border-gray-200 dark:border-gray-700 
            shadow-sm hover:shadow-md transition-all group cursor-pointer
            ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-indigo-500 z-50' : ''}
          `}
        >
          {/* Priority and Assignee */}
          <div className="flex justify-between items-start mb-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${getPriorityColor(
                task.priority
              )}`}
            >
              {task.priority || 'low'}
            </span>

            {/* Assignees Avatars */}
            {task.assignees && task.assignees.length > 0 ? (
              <div className="flex -space-x-2">
                {task.assignees.slice(0, 3).map((assignee: any, idx: number) => (
                  <img
                    key={idx}
                    src={
                      assignee.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        assignee.username || assignee.name || 'User'
                      )}&background=random`
                    }
                    className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-800"
                    alt={assignee.username || assignee.name}
                    title={assignee.username || assignee.name}
                  />
                ))}
                {task.assignees.length > 3 && (
                  <div className="w-6 h-6 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                    +{task.assignees.length - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-400">
                ?
              </div>
            )}
          </div>

          {/* Task Title */}
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 line-clamp-2 leading-snug">
            {task.title}
          </h4>

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.labels.slice(0, 2).map((label, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                >
                  {label}
                </span>
              ))}
              {task.labels.length > 2 && (
                <span className="text-xs text-gray-400">+{task.labels.length - 2}</span>
              )}
            </div>
          )}

          {/* Metadata Footer */}
          <div className="flex items-center justify-between text-gray-400 text-xs mt-3">
            <div className="flex items-center gap-2">
              {/* Due Date */}
              {task.dueDate && (
                <div
                  className={`flex items-center gap-1 ${
                    isOverdue ? 'text-red-500 font-medium' : ''
                  }`}
                  title={`Due: ${new Date(task.dueDate).toLocaleDateString()}`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(task.dueDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {/* Linked PR */}
              {task.linkedPRId && (
                <div className="flex items-center gap-1 text-purple-500" title="Linked PR">
                  <GitPullRequest className="w-3 h-3" />
                  {typeof task.linkedPRId === 'object' && 'number' in task.linkedPRId && (
                    <span>#{task.linkedPRId.number}</span>
                  )}
                </div>
              )}

              {/* Blocked Indicator */}
              {task.status === 'blocked' && (
                <div className="flex items-center gap-1 text-red-500" title="Blocked">
                  <AlertCircle className="w-3 h-3" />
                </div>
              )}
            </div>

            {/* Comments & Attachments */}
            <div className="flex items-center gap-2">
              {task.commentsCount > 0 && (
                <span className="flex items-center gap-0.5" title={`${task.commentsCount} comments`}>
                  <MessageSquare className="w-3 h-3" />
                  {task.commentsCount}
                </span>
              )}
              {task.attachments && task.attachments.length > 0 && (
                <span
                  className="flex items-center gap-0.5"
                  title={`${task.attachments.length} attachments`}
                >
                  <Paperclip className="w-3 h-3" />
                  {task.attachments.length}
                </span>
              )}
              {task.linkedFiles && task.linkedFiles.length > 0 && (
                <span
                  className="flex items-center gap-0.5"
                  title={`${task.linkedFiles.length} linked files`}
                >
                  <Paperclip className="w-3 h-3" />
                  {task.linkedFiles.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;
