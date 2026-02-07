import { useEffect, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import type { Project, Task } from "../types";
import { createTask, getTasks, updateTask, deleteTask } from "../services/taskService";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../hooks/useAuth";

// Map internal status to display config
const COLUMN_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  todo: { label: "To Do", color: "text-gray-300", border: "border-gray-600" },
  in_progress: { label: "In Progress", color: "text-blue-400", border: "border-blue-500" },
  review: { label: "Review", color: "text-yellow-400", border: "border-yellow-500" },
  done: { label: "Done", color: "text-green-400", border: "border-green-500" },
};

const ORDERED_COLUMNS = ["todo", "in_progress", "done"] as const;

const TaskCard = ({ task, onDelete }: { task: Task, onDelete: (id: string) => void }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [, dragRef] = useDrag(() => ({
    type: "TASK",
    item: { id: task._id },
  }));

  dragRef(cardRef);

  const assignee = task.assignees && task.assignees.length > 0 ? task.assignees[0] : null;

  return (
    <div 
        ref={cardRef} 
        className="bg-[#0b0c10] border border-gray-800 p-5 rounded-xl shadow-sm hover:border-gray-600 cursor-grab active:cursor-grabbing transition-all mb-4 group relative"
    >
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task._id);
        }}
        className="absolute top-3 right-3 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
        title="Delete Task"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div className="mb-4 pr-6">
        <h4 className="text-base font-bold text-white mb-2">{task.title}</h4>
        {task.description && (
          <p className="text-sm text-gray-400 line-clamp-2 font-mono">{task.description}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 mb-4">
        {assignee && (
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300 uppercase">
                    {(assignee.name || "U").substring(0, 2)}
                </div>
                <span className="text-sm text-gray-400 font-mono">{assignee.name}</span>
            </div>
        )}
        
        {task.dueDate && (
             <div className="text-xs font-mono text-gray-500 pl-1">
                Due: {new Date(task.dueDate).toLocaleDateString()}
             </div>
        )}
      </div>
    </div>
  );
};

const Column = ({
  status,
  tasks,
  onMove,
  onDelete,
}: {
  status: Task["status"];
  tasks: Task[];
  onMove: (taskId: string, status: Task["status"]) => void;
  onDelete: (taskId: string) => void;
}) => {
  const columnRef = useRef<HTMLDivElement | null>(null);
  const [{ isOver }, dropRef] = useDrop(() => ({
    accept: "TASK",
    drop: (item: { id: string }) => onMove(item.id, status),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  dropRef(columnRef);

  const config = COLUMN_CONFIG[status] || COLUMN_CONFIG.todo;

  return (
    <div ref={columnRef} className={`flex-1 min-h-[400px] flex flex-col rounded-xl bg-[#0d1117] border border-gray-800 transition-colors ${isOver ? 'bg-gray-800/20 border-indigo-500/30' : ''}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
             <h3 className={`font-mono text-sm font-bold ${config.color || 'text-white'}`}>{config.label}</h3>
             <span className="bg-[#161b22] border border-gray-700 text-gray-400 text-xs px-2 py-0.5 rounded font-mono">
                 {tasks.length}
             </span>
        </div>
        <div className={`h-1 w-full rounded-full bg-gray-800 mb-2 overflow-hidden`}>
             <div className={`h-full w-full ${config.border.replace('border-', 'bg-')} opacity-80`} />
        </div>
      </div>
      
      <div className="p-4 pt-0 flex-1 overflow-y-auto custom-scrollbar">
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onDelete={onDelete} />
        ))}
        {tasks.length === 0 && (
            <div className="h-24 border-2 border-dashed border-gray-800 rounded-lg flex items-center justify-center text-xs text-gray-600 font-mono">
                Empty
            </div>
        )}
      </div>
    </div>
  );
};

const TaskBoard = ({ project }: { project: Project }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  
  // Create Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [deadline, setDeadline] = useState("");
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const projectId = project._id || project.id; // Handle both id formats

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTasks(projectId);
        setTasks(data);
      } catch (err) {
        console.error("Failed to load tasks", err);
      }
    };
    if (projectId) load();
  }, [projectId]);

  useEffect(() => {
    if (!socket || !projectId) return;

    const onCreated = ({ task }: { task: Task }) => {
      if (task.projectId === projectId) setTasks((prev) => [task, ...prev]);
    };

    const onUpdated = ({ task }: { task: Task }) => {
      if (task.projectId === projectId) {
        setTasks((prev) => prev.map((item) => (item._id === task._id ? task : item)));
      }
    };

    const onDeleted = ({ taskId }: { taskId: string }) => {
      setTasks((prev) => prev.filter((item) => item._id !== taskId));
    };

    socket.on("task_created", onCreated);
    socket.on("task_updated", onUpdated);
    socket.on("task_moved", onUpdated);
    socket.on("task_deleted", onDeleted);
    socket.emit("join_room", { projectId });

    return () => {
      socket.off("task_created", onCreated);
      socket.off("task_updated", onUpdated);
      socket.off("task_moved", onUpdated);
      socket.off("task_deleted", onDeleted);
    };
  }, [socket, projectId]);

  const grouped = useMemo(() => {
    return ORDERED_COLUMNS.reduce((acc, status) => {
      acc[status] = tasks.filter((task) => {
          // Map backend status to columns. 
          // If 'review' is not a column, put it in in_progress or separate. 
          // Assuming simple flow for now.
          if (status === 'in_progress' && (task.status === 'review' || task.status === 'in_progress')) return true;
          return task.status === status;
      });
      return acc;
    }, {} as Record<string, Task[]>);
  }, [tasks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      // @ts-ignore - Backend expects IDs for assignees on create, though type is User[]
      await createTask(projectId, { 
          title, 
          description, 
          status: 'todo', 
          priority: 'medium',
          dueDate: deadline || undefined,
          assignees: assignedTo ? [assignedTo] : [],
      });
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setDeadline("");
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async (taskId: string, status: Task["status"]) => {
    // Optimistic update
    setTasks((prev) => prev.map((task) => (task._id === taskId ? { ...task, status } : task)));
    try {
      await updateTask(projectId, taskId, { status });
    } catch (err) {
      // Revert if failed (could implement revert logic here)
      console.error("Move failed", err);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    // Optimistic update
    setTasks((prev) => prev.filter((task) => task._id !== taskId));
    try {
      await deleteTask(projectId, taskId);
    } catch (err) {
      console.error("Delete failed", err);
      // Revert would require re-fetching or knowing the deleted task state
      const data = await getTasks(projectId);
      setTasks(data);
    }
  };

  const members = project.members?.map(m => m.user) || [];
  if (project.owner) members.push(project.owner);
  // unique members
  const uniqueMembers = Array.from(new Map(members.map(m => [m.id || m._id, m])).values());

  return (
    <div className="h-full flex flex-col px-8 py-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold font-mono text-white tracking-tight">Task Board</h2>
        <button 
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[#6366f1] hover:bg-[#5558e0] text-white rounded-md font-medium text-sm transition-colors flex items-center gap-2"
        >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
        </button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-8">
          {ORDERED_COLUMNS.map((status) => (
            <Column
              key={status}
              status={status as Task["status"]}
              tasks={grouped[status] || []}
              onMove={handleMove}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </DndProvider>
      
      {/* Create Task Modal */}
      {showCreate && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0b0c10] border border-gray-800 rounded-xl p-8 w-full max-w-lg shadow-2xl relative">
                <button 
                    onClick={() => setShowCreate(false)} 
                    className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <h3 className="text-2xl font-bold font-mono text-white mb-8">Create New Task</h3>
                
                <form onSubmit={handleCreate} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-200 mb-2 font-mono">Title</label>
                        <input 
                            className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono text-sm" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            required 
                            placeholder="Task title" 
                        />
                    </div>
                   <div>
                        <label className="block text-sm font-bold text-gray-200 mb-2 font-mono">Description</label>
                        <textarea 
                            className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none h-32 resize-none transition-all font-mono text-sm" 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="Task description" 
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-5">
                        <div>
                             <label className="block text-sm font-bold text-gray-200 mb-2 font-mono">Assign To</label>
                             <div className="relative">
                                <select 
                                    className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none appearance-none font-mono text-sm"
                                    value={assignedTo}
                                    onChange={e => setAssignedTo(e.target.value)}
                                >
                                    <option value="">Select member</option>
                                    {uniqueMembers.map(m => (
                                        <option key={m.id || m._id} value={m.id || m._id}>{m.name}</option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                             </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-200 mb-2 font-mono">Deadline</label>
                            <input 
                                type="date"
                                className="w-full bg-[#111] border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono text-sm [&::-webkit-calendar-picker-indicator]:invert" 
                                value={deadline} 
                                onChange={e => setDeadline(e.target.value)} 
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3.5 bg-[#6366f1] hover:bg-[#5558e0] text-white rounded-lg font-bold text-base transition-all shadow-lg shadow-indigo-500/20 mt-4 font-mono"
                    >
                        {loading ? "Creating..." : "Create Task"}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;
