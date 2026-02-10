import React, { useState, useEffect, useMemo } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { Task } from '../types';
import { taskService } from '../services/taskService';
import { useTasksSocket } from '../hooks/useTasksSocket';
import Column from './Column';
import TaskModal from './TaskModal';
import CreateTaskModal from './CreateTaskModal';
import TaskFilters from './TaskFilters';
import { Plus, Filter, BarChart3 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const COLUMNS = {
  todo: { title: 'To Do', color: 'bg-gray-50 dark:bg-[#161b22]' },
  in_progress: { title: 'In Progress', color: 'bg-blue-50/50 dark:bg-blue-900/10' },
  review: { title: 'Review', color: 'bg-yellow-50/50 dark:bg-yellow-900/10' },
  blocked: { title: 'Blocked', color: 'bg-red-50/50 dark:bg-red-900/10' },
  done: { title: 'Done', color: 'bg-green-50/50 dark:bg-green-900/10' },
};

interface TaskBoardProps {
  projectId: string;
  initialTasks?: Task[];
  onRefresh?: () => void;
}

const TaskBoard: React.FC<TaskBoardProps> = ({ projectId, initialTasks }) => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks ?? []);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<string>('todo');
  const [filters, setFilters] = useState({
    search: '',
    priority: [] as string[],
    assignee: null as string | null,
    labels: [] as string[],
  });

  // Sync with parent's task list
  useEffect(() => {
    setTasks(initialTasks ?? []);
  }, [initialTasks]);

  // Socket integration for real-time updates
  useTasksSocket({
    projectId,
    onTaskCreated: (task) => {
      setTasks((prev) => [...prev, task]);
      toast.success(`New task created: ${task.title}`);
    },
    onTaskUpdated: ({ task, changedFields }) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
      // Update selected task if it's the one being viewed
      if (selectedTask && selectedTask._id === task._id) {
        setSelectedTask(task);
      }
    },
    onTaskMoved: ({ task }) => {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    },
    onTaskDeleted: ({ taskId }) => {
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask(null);
      }
      toast.success('Task deleted');
    },
    onTaskComment: ({ taskId }) => {
      // Refresh the specific task to get new comment count
      // Note: getTask doesn't exist in current API, task updates come via socket
      // if (selectedTask && selectedTask._id === taskId) {
      //   taskService.getTask(projectId, taskId).then((task) => {
      //     setSelectedTask(task);
      //     setTasks((prev) => prev.map((t) => (t._id === taskId ? task : t)));
      //   });
      // }
    },
  });

  // Filter and organize tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (
          !task.title.toLowerCase().includes(searchLower) &&
          !task.description?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) {
        return false;
      }

      // Assignee filter
      if (filters.assignee) {
        const hasAssignee = task.assignees?.some(
          (a: any) => a._id === filters.assignee || a === filters.assignee
        );
        if (!hasAssignee) return false;
      }

      // Labels filter
      if (filters.labels.length > 0) {
        const hasLabel = filters.labels.some((label) => task.labels?.includes(label));
        if (!hasLabel) return false;
      }

      return true;
    });
  }, [tasks, filters]);

  // Organize tasks by column
  const columns = useMemo(() => {
    const cols: Record<string, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      blocked: [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      const status = task.status in cols ? task.status : 'todo';
      cols[status].push(task);
    });

    // Sort by orderKey
    Object.keys(cols).forEach((key) => {
      cols[key].sort((a, b) => (a.orderKey || 0) - (b.orderKey || 0));
    });

    return cols;
  }, [filteredTasks]);

  // Handle drag and drop
  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    const sourceColTasks = [...columns[source.droppableId]];
    const destColTasks =
      source.droppableId === destination.droppableId
        ? sourceColTasks
        : [...columns[destination.droppableId]];

    const [movedTask] = sourceColTasks.splice(source.index, 1);

    // Calculate new orderKey
    let newOrderKey: number;
    if (destination.index === 0) {
      newOrderKey = destColTasks.length > 0 ? destColTasks[0].orderKey! - 1000 : 1000;
    } else if (destination.index >= destColTasks.length) {
      newOrderKey =
        destColTasks.length > 0
          ? destColTasks[destColTasks.length - 1].orderKey! + 1000
          : 1000;
    } else {
      const prev = destColTasks[destination.index - 1];
      const next = destColTasks[destination.index];
      newOrderKey = Math.floor((prev.orderKey! + next.orderKey!) / 2);
    }

    // Optimistic update
    const updatedTask = {
      ...movedTask,
      status: destination.droppableId as any,
      orderKey: newOrderKey,
    };

    if (source.droppableId === destination.droppableId) {
      sourceColTasks.splice(destination.index, 0, updatedTask);
    } else {
      destColTasks.splice(destination.index, 0, updatedTask);
    }

    // Update local state immediately for smooth UX
    setTasks((prev) => prev.map((t) => (t._id === draggableId ? updatedTask : t)));

    // Call API
    try {
      await taskService.moveTask(projectId, draggableId, {
        toStatus: destination.droppableId as any,
        toOrderKey: newOrderKey,
        fromStatus: source.droppableId,
      });
    } catch (error: any) {
      console.error('Failed to move task:', error);
      toast.error(error.message || 'Failed to move task');
      // Revert on error
      setTasks((prev) => prev.map((t) => (t._id === draggableId ? movedTask : t)));
    }
  };

  // Handlers
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleQuickAdd = (status: string) => {
    setCreateModalStatus(status);
    setIsCreateModalOpen(true);
  };

  const handleTaskCreated = (task: Task) => {
    setTasks((prev) => [...prev, task]);
    setIsCreateModalOpen(false);
  };

  const handleTaskUpdated = (task: Task) => {
    setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
    setSelectedTask(task);
  };

  const handleTaskDeleted = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
    setSelectedTask(null);
  };

  // Calculate stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, completionRate };
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Stats and Actions */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0d1117]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tasks</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats.total} total • {stats.inProgress} in progress • {stats.completed} completed (
              {stats.completionRate}%)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
                isFiltersOpen
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {isFiltersOpen && (
          <TaskFilters filters={filters} onFiltersChange={setFilters} projectId={projectId} />
        )}
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-4 p-4 items-start min-w-max">
            {Object.entries(COLUMNS).map(([colId, colDef]) => (
              <Column
                key={colId}
                columnId={colId}
                title={colDef.title}
                tasks={columns[colId]}
                count={columns[colId].length}
                onTaskClick={handleTaskClick}
                onQuickAdd={() => handleQuickAdd(colId)}
                color={colDef.color}
              />
            ))}
          </div>
        </div>
      </DragDropContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdated}
          onDelete={handleTaskDeleted}
        />
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <CreateTaskModal
          projectId={projectId}
          initialStatus={createModalStatus}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleTaskCreated}
        />
      )}
    </div>
  );
};

export default TaskBoard;
