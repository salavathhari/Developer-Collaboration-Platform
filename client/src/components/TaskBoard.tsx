import { useEffect, useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import type { Project, Task, Column as ColumnType, User } from "../types";
import { getTasks, createTask, updateTask, deleteTask, reorderTasks } from "../services/taskService";
import { getColumns, createColumn, deleteColumn } from "../services/columnService";
import { useSocket } from "../hooks/useSocket";
import { useVideo } from "../context/VideoContext";

const TaskBoard = ({ project }: { project: Project }) => {
  const [columns, setColumns] = useState<ColumnType[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTaskToColumn, setAddingTaskToColumn] = useState<string | null>(null);

  const token = localStorage.getItem("token");
  const socket = useSocket(token);
  const { startCall } = useVideo();

  const fetchData = useCallback(async () => {
    try {
      const [colsData, tasksData] = await Promise.all([
        getColumns(project._id),
        getTasks(project._id)
      ]);
      setColumns(colsData);
      setTasks(tasksData);
    } catch (err) {
      console.error(err);
    }
  }, [project._id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    const handleReorder = () => {
        fetchData(); 
    };
    
    socket.on("tasks_reordered", handleReorder);
    socket.on("task_created", fetchData);
    socket.on("task_updated", fetchData);
    socket.on("task_deleted", fetchData);

    return () => {
        socket.off("tasks_reordered", handleReorder);
        socket.off("task_created", fetchData);
        socket.off("task_updated", fetchData);
        socket.off("task_deleted", fetchData);
    };
  }, [socket, fetchData]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return;

    const changingTask = tasks.find(t => t._id === draggableId);
    if (!changingTask) return;

    // Optimistic Update
    const allTasks = Array.from(tasks);
    
    // Sort tasks in the destination column
    const destColId = destination.droppableId;
    const destTasks = allTasks
        .filter(t => (t.columnId) === destColId && t._id !== draggableId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Insert the draggable
    destTasks.splice(destination.index, 0, { ...changingTask, columnId: destColId } as Task);
    
    // Recalculate orders for destination column
    const updates = destTasks.map((t, index) => ({
        ...t,
        order: index,
        columnId: destColId
    }));

    // Update local state: Replace changed tasks
    const otherTasks = allTasks.filter(t => !updates.find(u => u._id === t._id) && t._id !== draggableId);
    setTasks([...otherTasks, ...updates]);

    // Send payload
    const apiPayload = updates.map(t => ({
        _id: t._id,
        order: t.order,
        columnId: t.columnId,
        status: t.status 
    }));

    try {
        await reorderTasks(project._id, apiPayload);
    } catch (err) {
        console.error("Failed to reorder", err);
        fetchData(); 
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    try {
        const col = await createColumn(project._id, newColumnName);
        setColumns([...columns, col]);
        setNewColumnName("");
        setIsAddingColumn(false);
    } catch (err) {
        console.error(err);
    }
  };

  const handleAddTask = async (columnId: string) => {
    if (!newTaskTitle.trim()) return;
    try {
        // Find max order in col
        const colTasks = tasks.filter(t => t.columnId === columnId);
        const maxOrder = Math.max(...colTasks.map(t => t.order || 0), -1);

        await createTask(project._id, {
            title: newTaskTitle,
            columnId,
            order: maxOrder + 1,
            projectId: project._id,
            type: 'task'
        });
        setNewTaskTitle("");
        setAddingTaskToColumn(null);
    } catch (err) {
        console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
      if(!confirm("Are you sure?")) return;
      await deleteTask(project._id, taskId);
  };

  const handleDeleteColumn = async (colId: string) => {
      if(!confirm("Delete column?")) return;
      try {
        await deleteColumn(colId);
        setColumns(columns.filter(c => c._id !== colId));
      } catch(err) {
          alert("Cannot delete column with tasks");
      }
  };

  // Group tasks for rendering
  const tasksByColumn: Record<string, Task[]> = {};
  columns.forEach(c => {
      tasksByColumn[c._id] = tasks
        .filter(t => t.columnId === c._id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
  });

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#050505]">
            <h2 className="text-xl font-bold text-white">Board</h2>
            <button 
                onClick={() => setIsAddingColumn(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
                + Add Column
            </button>
        </div>

        {isAddingColumn && (
              <div className="px-6 py-3 bg-[#0d1017] border-b border-gray-800 flex items-center gap-2">
                  <input 
                    autoFocus
                    value={newColumnName} 
                    onChange={e => setNewColumnName(e.target.value)}
                    placeholder="Column Name (e.g. Todo)"
                    className="bg-[#050505] border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                  />
                  <button onClick={handleAddColumn} className="text-indigo-400 hover:text-indigo-300 text-sm font-bold">Save</button>
                  <button onClick={() => setIsAddingColumn(false)} className="text-gray-500 hover:text-gray-400 text-sm">Cancel</button>
              </div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="h-full flex px-6 py-6 gap-6 min-w-max">
                    {columns.map(column => (
                        <div key={column._id} className="w-80 flex flex-col bg-[#0d1017] rounded-xl border border-gray-800 max-h-full">
                            {/* Column Header */}
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center group">
                                <h3 className="font-bold text-gray-200">{column.name}</h3>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-gray-500 font-mono">{tasksByColumn[column._id]?.length || 0}</span>
                                    <button onClick={() => handleDeleteColumn(column._id)} className="text-gray-600 hover:text-red-400">
                                        &times;
                                    </button>
                                </div>
                            </div>

                            {/* Column Body */}
                            <Droppable droppableId={column._id}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-700 ${snapshot.isDraggingOver ? 'bg-gray-800/30' : ''}`}
                                        style={{ minHeight: '100px' }}
                                    >
                                        {tasksByColumn[column._id]?.map((task, index) => (
                                            <Draggable key={task._id} draggableId={task._id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`bg-[#161b22] border border-gray-700 p-3 rounded-lg shadow-sm group hover:border-gray-500 transition-colors ${snapshot.isDragging ? 'rotate-2 shadow-xl ring-2 ring-indigo-500/50 z-50' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                                                                task.type === 'bug' ? 'bg-red-500/10 text-red-400' : 
                                                                task.type === 'feature' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                                                            }`}>{task.type || 'task'}</span>
                                                            <button 
                                                                onClick={() => handleDeleteTask(task._id)}
                                                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                                                            >
                                                                &times;
                                                            </button>
                                                        </div>
                                                        <p className="text-sm text-gray-200 font-medium mb-2">{task.title}</p>
                                                        <div className="flex items-center justify-between mt-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex -space-x-1">
                                                                    {task.assignees?.slice(0, 3).map((u, i) => (
                                                                        <div key={i} className="w-5 h-5 rounded-full bg-gray-700 border border-[#161b22] flex items-center justify-center text-[8px] text-white">
                                                                            {u.name?.[0]}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <button 
                                                                    onClick={() => startCall(project._id, 'task', task._id)}
                                                                    className="text-gray-500 hover:text-green-500 transition-colors p-1 rounded hover:bg-gray-800"
                                                                    title="Discuss via Video"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                                </button>
                                                            </div>
                                                            {task.priority && (
                                                                <span className={`w-2 h-2 rounded-full ${
                                                                    task.priority === 'high' ? 'bg-red-500' :
                                                                    task.priority === 'medium' ? 'bg-orange-400' : 'bg-blue-400'
                                                                }`} title={`Priority: ${task.priority}`} />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>

                            {/* Add Task Input */}
                            <div className="p-3 pt-0 bg-[#0d1017] rounded-b-xl">
                                {addingTaskToColumn === column._id ? (
                                    <div className="bg-[#161b22] border border-indigo-500/50 p-2 rounded-lg">
                                        <textarea 
                                            autoFocus
                                            className="w-full bg-transparent text-sm text-white placeholder-gray-600 outline-none resize-none"
                                            placeholder="Enter task title..."
                                            rows={2}
                                            value={newTaskTitle}
                                            onChange={e => setNewTaskTitle(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleAddTask(column._id);
                                                }
                                            }}
                                        />
                                        <div className="flex justify-end gap-2 mt-2">
                                            <button onClick={() => setAddingTaskToColumn(null)} className="text-xs text-gray-500 hover:text-white">Cancel</button>
                                            <button onClick={() => handleAddTask(column._id)} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">Add</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => setAddingTaskToColumn(column._id)}
                                        className="w-full py-2 flex items-center justify-center gap-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 rounded-lg transition-all text-sm dashed-border"
                                    >
                                        <span>+ Add Task</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DragDropContext>
    </div>
  );
};

export default TaskBoard;
