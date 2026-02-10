import React, { useState } from 'react';
import { type Task, type User } from '../types';
import { taskService } from '../services/taskService';
import { X, User as UserIcon, Calendar, Clock, Paperclip, Send, Trash2, CheckSquare, MessageSquare, Tag, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface TaskModalProps {
  projectId: string;
  task: Task;
  projectMembers: User[]; // Simplification: pass members for assignment
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  onDelete: (taskId: string) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ projectId, task, projectMembers, onClose, onUpdate, onDelete }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'comments'>('details');
  const [commentText, setCommentText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Edit states
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description || '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assignee, setAssignee] = useState((Array.isArray(task.assignees) && task.assignees[0]?._id) || (task.assignedTo?._id) || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [labels, setLabels] = useState<string[]>(task.labels || []);
  const [newLabel, setNewLabel] = useState('');

  const handleSave = async () => {
      try {
          const result = await taskService.updateTask(projectId, task._id, {
              title,
              description: desc,
              status: status as any,
              priority: priority as any,
              assignees: assignee ? [assignee] : undefined,
              dueDate: dueDate || undefined,
              labels
          });
          onUpdate(result.task);
          setEditing(false);
      } catch (e) {
          console.error(e);
      }
  };

  const activeAssignee = projectMembers?.find(m => m._id === assignee);

  const handleComment = async () => {
      if (!commentText.trim()) return;
      try {
          const result = await taskService.addComment(projectId, task._id, commentText);
          onUpdate(result.task);
          setCommentText('');
      } catch (e) { console.error(e); }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;
      setUploading(true);
      try {
          const result = await taskService.uploadAttachment(projectId, task._id, e.target.files[0]);
          onUpdate(result.task);
      } catch (e) { console.error(e); }
      finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0d1117] w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden border border-gray-800">
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="h-16 px-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#161b22]">
                <div className="flex items-center gap-3">
                    {editing ? (
                        <input 
                          value={title} 
                          onChange={e => setTitle(e.target.value)} 
                          className="bg-white dark:bg-black border border-gray-600 rounded px-2 py-1 font-bold text-lg text-white w-full" 
                        />
                    ) : (
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate max-w-md" title={task.title}>{task.title}</h2>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {!editing && (
                        <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                            Edit
                        </button>
                    )}
                     {editing && (
                        <button onClick={handleSave} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">
                            Save
                        </button>
                    )}
                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-1" />
                    <button onClick={() => onDelete(task._id)} className="p-2 text-gray-500 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-3 gap-8">
                    {/* Left Col */}
                    <div className="col-span-2 space-y-6">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Description</label>
                            {editing ? (
                                <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-32 bg-white dark:bg-black border border-gray-600 rounded p-3 text-sm dark:text-gray-300" />
                            ) : (
                                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                    {task.description || <em className="text-gray-500">No description provided.</em>}
                                </div>
                            )}
                        </div>

                        {/* Attachments */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Attachments</label>
                                <label className="cursor-pointer text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1">
                                    <Paperclip className="w-3 h-3" /> Add File
                                    <input type="file" className="hidden" onChange={handleFileUpload} />
                                </label>
                            </div>
                            <div className="space-y-2">
                                {task.attachments?.map((att, i) => (
                                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gray-800 rounded-lg">
                                        <div className="w-8 h-8 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 rounded text-indigo-500">
                                            <Paperclip className="w-4 h-4" />
                                        </div>
                                        <a href={att} target="_blank" rel="noreferrer" className="text-sm text-indigo-500 hover:underline truncate flex-1">
                                            {att.split('/').pop()}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Comments */}
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Comments
                            </h3>
                            <div className="space-y-4 mb-4">
                                {task.comments?.map((c, i) => (
                                    <div key={i} className="flex gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                            {c.userId?.name?.[0]}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-sm text-gray-900 dark:text-white">{c.userId?.name || 'Unknown'}</span>
                                                <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#161b22] p-3 rounded-lg rounded-tl-none">
                                                {c.text}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                  value={commentText}
                                  onChange={e => setCommentText(e.target.value)}
                                  placeholder="Write a comment..."
                                  className="flex-1 bg-white dark:bg-black border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-white"
                                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                                />
                                <button onClick={handleComment} className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Col - Meta */}
                    <div className="space-y-6">
                        {/* Status */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Status</label>
                             {editing ? (
                                <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white">
                                    <option value="todo">To Do</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="review">Review</option>
                                    <option value="blocked">Blocked</option>
                                    <option value="done">Done</option>
                                </select>
                             ) : (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                             )}
                        </div>

                        {/* Priority */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Priority</label>
                             {editing ? (
                                <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white">
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                             ) : (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                    priority === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 
                                    priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                                    priority === 'medium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                    {priority}
                                </span>
                             )}
                        </div>

                         {/* Assignee */}
                         <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Assignee</label>
                             {editing ? (
                                <select value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white">
                                    <option value="">Unassigned</option>
                                    {projectMembers?.map(m => (
                                        <option key={m._id} value={m._id}>{m.name}</option>
                                    ))}
                                </select>
                             ) : (
                                <div className="flex items-center gap-2">
                                    {activeAssignee ? (
                                        <>
                                            <img src={activeAssignee.avatar || `https://ui-avatars.com/api/?name=${activeAssignee.name}`} className="w-6 h-6 rounded-full" />
                                            <span className="text-sm dark:text-gray-300">{activeAssignee.name}</span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-gray-500 italic">Unassigned</span>
                                    )}
                                </div>
                             )}
                        </div>

                        {/* Due Date */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Due Date</label>
                             {editing ? (
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="w-full bg-[#161b22] border border-gray-700 rounded p-2 text-sm text-white"
                                />
                             ) : (
                                <div className="flex items-center gap-2">
                                    {task.dueDate ? (
                                        <>
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <span className={`text-sm ${new Date(task.dueDate) < new Date() ? 'text-red-500 font-medium' : 'dark:text-gray-300'}`}>
                                                {new Date(task.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}
                                                {new Date(task.dueDate) < new Date() && ' (Overdue)'}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-gray-500 italic">No due date</span>
                                    )}
                                </div>
                             )}
                        </div>

                        {/* Labels */}
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Labels</label>
                             {editing ? (
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1">
                                        {labels.map((label, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 bg-indigo-900/30 text-indigo-300 px-2 py-0.5 rounded-full text-xs">
                                                {label}
                                                <button
                                                    onClick={() => setLabels(labels.filter((_, i) => i !== idx))}
                                                    className="hover:text-red-400"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            value={newLabel}
                                            onChange={e => setNewLabel(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && newLabel.trim()) {
                                                    setLabels([...labels, newLabel.trim()]);
                                                    setNewLabel('');
                                                }
                                            }}
                                            placeholder="Add label..."
                                            className="flex-1 bg-[#0d1117] border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                        />
                                        <button
                                            onClick={() => {
                                                if (newLabel.trim()) {
                                                    setLabels([...labels, newLabel.trim()]);
                                                    setNewLabel('');
                                                }
                                            }}
                                            className="p-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                             ) : (
                                <div className="flex flex-wrap gap-1">
                                    {task.labels && task.labels.length > 0 ? (
                                        task.labels.map((label, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 bg-indigo-900/30 text-indigo-300 px-2 py-0.5 rounded-full text-xs">
                                                <Tag className="w-3 h-3" />
                                                {label}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-sm text-gray-500 italic">No labels</span>
                                    )}
                                </div>
                             )}
                        </div>

                        {/* Created Info */}
                        <div className="pt-4 border-t border-gray-700">
                            <p className="text-xs text-gray-500">
                                Created {new Date(task.createdAt).toLocaleDateString()}
                            </p>
                            {task.createdBy && (
                                <p className="text-xs text-gray-500 mt-1">
                                    by {task.createdBy.name}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
