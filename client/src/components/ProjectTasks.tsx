import React, { useState, useEffect } from 'react';
import type { Task, Project, User } from '../types';
import { taskService } from '../services/taskService';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadTasks();
  }, [project._id]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const result = await taskService.getTasks(project._id);
      setTasks(Array.isArray(result.tasks) ? result.tasks : []); // Ensure we always have an array
    } catch (err) {
      console.error("Failed to load tasks", err);
      setTasks([]); // Set empty array on error
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

  // Client-side filtering for responsiveness, or use API if list is huge
  // We implemented API params, but client-side is smoother for small lists < 1000
  const filteredTasks = tasks.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
      const matchesAssignee = filterAssignee === 'all' || (t.assignedTo?._id === filterAssignee);
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      return matchesSearch && matchesPriority && matchesAssignee && matchesStatus;
  });

  // Quick stats
  const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'done').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done').length
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading tasks...</div>;

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
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="bg-[#111] border border-white/10 rounded-full pl-9 pr-4 py-1.5 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none w-64 transition-colors"
                />
            </div>
            
            <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                <Filter className="w-4 h-4 text-gray-500" />
                <select 
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="bg-transparent text-sm text-gray-400 focus:text-white focus:outline-none cursor-pointer"
                >
                    <option value="all">Any Status</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                </select>
            </div>
            
            <div className="flex items-center gap-2">
                <select 
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value)}
                    className="bg-transparent text-sm text-gray-400 focus:text-white focus:outline-none cursor-pointer"
                >
                    <option value="all">Any Priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                 <select 
                    value={filterAssignee}
                    onChange={e => setFilterAssignee(e.target.value)}
                    className="bg-transparent text-sm text-gray-400 focus:text-white focus:outline-none cursor-pointer"
                >
                    <option value="all">Any Assignee</option>
                    <option value="">Unassigned</option>
                    {project.members?.map(m => (
                        <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                    ))}
                </select>
            </div>

            {(filterStatus !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterPriority('all');
                  setFilterAssignee('all');
                  setSearchQuery('');
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Clear filters
              </button>
            )}
        </div>

        <button 
            onClick={handleCreateTask}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        >
            <Plus className="w-4 h-4" />
            New Task
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden bg-[#050505]">
        <TaskBoard 
            projectId={project._id} 
            initialTasks={filteredTasks}
            onRefresh={loadTasks}
        />
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
