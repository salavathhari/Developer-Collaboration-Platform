import React, { useMemo, useState, useEffect } from 'react';
import type { Task, Project, User } from '../types';
import { taskService } from '../services/taskService';
import { getProjectMembers } from '../services/projectService';
import TaskBoard from './TaskBoard';
import TaskModal from './TaskModal';
import CreateTaskModal from './CreateTaskModal';
import { Plus, Filter, Search } from 'lucide-react';

interface ProjectTasksProps {
  project: Project;
}

const ProjectTasks: React.FC<ProjectTasksProps> = ({ project }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    assignee: 'all',
  });
  const [members, setMembers] = useState<Project['members']>([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeFilters = useMemo(() => {
    const items: Array<{ key: string; label: string }> = [];
    if (filters.search.trim()) {
      items.push({ key: 'search', label: `Search: ${filters.search}` });
    }
    if (filters.status !== 'all') {
      items.push({ key: 'status', label: `Status: ${filters.status.replace('_', ' ')}` });
    }
    if (filters.priority !== 'all') {
      items.push({ key: 'priority', label: `Priority: ${filters.priority}` });
    }
    if (filters.assignee !== 'all') {
      const member = members.find((m) => m.user._id === filters.assignee);
      items.push({ key: 'assignee', label: `Assignee: ${member?.user.name || 'Unassigned'}` });
    }
    return items;
  }, [filters, members]);

  useEffect(() => {
    loadTasks();
  }, [project._id]);

  useEffect(() => {
    if (!project._id) return;
    const loadMembers = async () => {
      try {
        const data = await getProjectMembers(project._id);
        setMembers(data.members || []);
      } catch (err) {
        console.error('Failed to load project members', err);
      }
    };
    loadMembers();
  }, [project._id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    loadTasks();
  }, [filters.status, filters.priority, filters.assignee, debouncedSearch, project._id]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await taskService.getTasks(project._id, {
        status: filters.status !== 'all' ? filters.status : undefined,
        priority: filters.priority !== 'all' ? filters.priority : undefined,
        assignee:
          filters.assignee !== 'all' && filters.assignee !== ''
            ? filters.assignee
            : undefined,
        search: debouncedSearch || undefined,
        limit: 200,
      });
      setTasks(Array.isArray(result.tasks) ? result.tasks : []); // Ensure we always have an array
    } catch (err) {
      console.error("Failed to load tasks", err);
      setTasks([]); // Set empty array on error
      setError('Unable to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCreateTask = () => {
    setIsCreateModalOpen(true);
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks([...tasks, newTask]);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
    if (selectedTask?._id === updatedTask._id) {
        setSelectedTask(updatedTask);
    }
  };

  const handleTaskDelete = async (taskId: string) => {
      if (!window.confirm("Are you sure you want to delete this task?")) return;
      try {
          await taskService.deleteTask(project._id, taskId);
          setTasks(prev => prev.filter(t => t._id !== taskId));
          setIsModalOpen(false);
          setSelectedTask(null);
      } catch (e) {
          console.error(e);
      }
  };

  const filteredTasks = useMemo(() => {
    const searchLower = filters.search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesSearch = !searchLower ||
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower);
      const matchesPriority = filters.priority === 'all' || task.priority === filters.priority;
      const matchesAssignee =
        filters.assignee === 'all' ||
        (filters.assignee === ''
          ? !task.assignees?.length && !task.assignedTo
          : task.assignees?.some((assignee) => assignee._id === filters.assignee) ||
            task.assignedTo?._id === filters.assignee);
      const matchesStatus = filters.status === 'all' || task.status === filters.status;
      return matchesSearch && matchesPriority && matchesAssignee && matchesStatus;
    });
  }, [tasks, filters]);

  // Quick stats
  const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-1/3 bg-gray-800/50 rounded animate-pulse" />
        <div className="h-16 bg-gray-800/30 rounded animate-pulse" />
        <div className="h-64 bg-gray-800/20 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#050505]">
      {/* Quick Stats Bar */}
      <div className="h-16 border-b border-white/5 px-6 bg-[#050505] flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-500"></div>
          <span className="text-sm text-gray-400">Total: <span className="text-white font-semibold">{stats.total}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="text-sm text-gray-400">In Progress: <span className="text-white font-semibold">{stats.inProgress}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-400">Completed: <span className="text-white font-semibold">{stats.completed}</span></span>
        </div>
        {stats.overdue > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span className="text-sm text-gray-400">Overdue: <span className="text-red-500 font-semibold">{stats.overdue}</span></span>
          </div>
        )}
        <div className="ml-auto text-xs text-gray-500">
          {stats.total > 0 && `${Math.round((stats.completed / stats.total) * 100)}% complete`}
        </div>
      </div>

      {/* Toolbar */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#050505]">
        <div className="flex items-center gap-4">
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Search tasks..." 
                  value={filters.search}
                  onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="bg-[#111] border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none w-64 transition-colors"
                />
            </div>
            
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <Filter className="w-4 h-4 text-gray-500" />
                <select 
                  value={filters.status}
                  onChange={e => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="bg-transparent text-sm text-gray-400 focus:text-white focus:outline-none cursor-pointer"
                >
                    <option value="all">Any Status</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
            </div>
            
            <div className="flex items-center gap-2">
                <select 
                  value={filters.priority}
                  onChange={e => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                    className="bg-transparent text-sm text-gray-400 focus:text-white focus:outline-none cursor-pointer"
                >
                    <option value="all">Any Priority</option>
                  <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                 <select 
                    value={filters.assignee}
                    onChange={e => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
                    className="bg-transparent text-sm text-gray-400 focus:text-white focus:outline-none cursor-pointer"
                >
                    <option value="all">Any Assignee</option>
                    <option value="">Unassigned</option>
                    {members?.map(m => (
                        <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                    ))}
                </select>
            </div>

            {(filters.status !== 'all' || filters.priority !== 'all' || filters.assignee !== 'all' || filters.search) && (
              <button
                onClick={() => {
                  setFilters({ search: '', status: 'all', priority: 'all', assignee: 'all' });
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Clear filters
              </button>
            )}
        </div>

        {error && (
          <div className="text-xs text-red-400">{error}</div>
        )}

        <button 
            onClick={handleCreateTask}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
            <Plus className="w-4 h-4" />
            New Task
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="px-6 py-3 border-b border-white/5 bg-[#050505] flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="text-xs text-gray-300 bg-white/5 border border-white/10 px-2 py-1 rounded-full"
            >
              {filter.label}
            </span>
          ))}
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden bg-[#050505]">
        {filteredTasks.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No tasks found.
          </div>
        ) : (
          <TaskBoard 
              projectId={project._id} 
              initialTasks={filteredTasks}
              onRefresh={loadTasks}
          />
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedTask && (
        <TaskModal
            projectId={project._id}
            task={selectedTask}
            projectMembers={project.members?.map(m => m.user) || []}
            onClose={() => setIsModalOpen(false)}
            onUpdate={handleTaskUpdate}
            onDelete={handleTaskDelete}
        />
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <CreateTaskModal
            projectId={project._id}
            projectMembers={project.members?.map(m => m.user) || []}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={handleTaskCreated}
        />
      )}
    </div>
  );
};

export default ProjectTasks;
