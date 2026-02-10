import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import type { Task } from '../types';
import TaskCard from './TaskCard';

interface ColumnProps {
  columnId: string;
  title: string;
  tasks: Task[];
  count: number;
  onTaskClick: (task: Task) => void;
  onQuickAdd: () => void;
  color?: string;
}

const Column: React.FC<ColumnProps> = ({
  columnId,
  title,
  tasks,
  count,
  onTaskClick,
  onQuickAdd,
  color = 'bg-gray-50 dark:bg-[#161b22]',
}) => {
  const getStatusIndicator = () => {
    switch (columnId) {
      case 'done':
        return 'bg-green-500';
      case 'blocked':
        return 'bg-red-500';
      case 'review':
        return 'bg-yellow-500';
      case 'in_progress':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  return (
    <div
      className={`flex-shrink-0 w-80 flex flex-col max-h-full rounded-xl border border-gray-200 dark:border-gray-800 ${color}`}
    >
      {/* Column Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-inherit rounded-t-xl z-10">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wider">
            {title}
          </h3>
          <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs font-mono">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusIndicator()}`} />
          <button
            onClick={onQuickAdd}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Quick add task"
          >
            <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[150px] transition-colors rounded-b-xl custom-scrollbar ${
              snapshot.isDraggingOver
                ? 'bg-indigo-50/50 dark:bg-indigo-900/10 ring-2 ring-indigo-400 ring-inset'
                : ''
            }`}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task._id}
                task={task}
                index={index}
                onClick={() => onTaskClick(task)}
              />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-600 text-sm">
                <p>No tasks</p>
                <p className="text-xs mt-1">Drag tasks here or click +</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default Column;
