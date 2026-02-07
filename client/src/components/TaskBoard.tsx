import { useEffect, useMemo, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import type { Task } from "../types";
import { createTask, getTasks, updateTask } from "../services/taskService";
import { useSocket } from "../hooks/useSocket";

const columns = ["todo", "in_progress", "review", "done"] as const;

const TaskCard = ({ task }: { task: Task }) => {
  const [, dragRef] = useDrag(() => ({
    type: "TASK",
    item: { id: task._id },
  }));

  const dueLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString()
    : null;

  return (
    <div ref={dragRef} className="task-card">
      <div className="task-card-header">
        <h4>{task.title}</h4>
        <span className={`priority-badge ${task.priority}`}>
          {task.priority}
        </span>
      </div>
      {task.description ? <p>{task.description}</p> : null}
      <div className="task-card-meta">
        {dueLabel ? <span className="due-pill">Due {dueLabel}</span> : null}
        <span className="status-pill">{task.status.replace("_", " ")}</span>
      </div>
    </div>
  );
};

const Column = ({
  status,
  tasks,
  onMove,
}: {
  status: Task["status"];
  tasks: Task[];
  onMove: (taskId: string, status: Task["status"]) => void;
}) => {
  const [, dropRef] = useDrop(() => ({
    accept: "TASK",
    drop: (item: { id: string }) => onMove(item.id, status),
  }));

  return (
    <div ref={dropRef} className="task-column">
      <h3>{status.replace("_", " ")}</h3>
      {tasks.map((task) => (
        <TaskCard key={task._id} task={task} />
      ))}
    </div>
  );
};

const TaskBoard = ({ projectId }: { projectId: string }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const socket = useSocket(localStorage.getItem("token"));

  useEffect(() => {
    const load = async () => {
      const data = await getTasks(projectId);
      setTasks(data);
    };

    load();
  }, [projectId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const onCreated = ({ task }: { task: Task }) => {
      if (task.projectId === projectId) {
        setTasks((prev) => [task, ...prev]);
      }
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

    return () => {
      socket.off("task_created", onCreated);
      socket.off("task_updated", onUpdated);
      socket.off("task_moved", onUpdated);
      socket.off("task_deleted", onDeleted);
    };
  }, [socket, projectId]);

  const grouped = useMemo(() => {
    return columns.reduce((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [tasks]);

  const handleCreate = async () => {
    if (!title.trim()) {
      return;
    }

    const task = await createTask(projectId, { title });
    setTasks((prev) => [task, ...prev]);
    setTitle("");
  };

  const handleMove = async (taskId: string, status: Task["status"]) => {
    const updated = await updateTask(projectId, taskId, { status });
    setTasks((prev) => prev.map((task) => (task._id === taskId ? updated : task)));
  };

  return (
    <div className="task-board">
      <div className="task-create">
        <input
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="New task title"
        />
        <button className="secondary-button light" type="button" onClick={handleCreate}>
          Add task
        </button>
      </div>

      <DndProvider backend={HTML5Backend}>
        <div className="task-columns">
          {columns.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={grouped[status] || []}
              onMove={handleMove}
            />
          ))}
        </div>
      </DndProvider>
    </div>
  );
};

export default TaskBoard;
