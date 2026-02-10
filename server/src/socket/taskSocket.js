const Task = require("../models/Task");
const PullRequest = require("../models/PullRequest");
const Project = require("../models/Project");
const taskService = require("../services/taskService");

/**
 * Socket.IO handlers for real-time task/Kanban operations
 * Provides bidirectional communication for drag & drop, updates, and notifications
 */
module.exports = (io, socket, userId) => {
  console.log(`[TaskSocket] User ${userId} connected`);

  /**
   * Join project tasks room
   * Client should call this when entering a project's task board
   */
  socket.on("joinProjectTasks", async (data) => {
    const { projectId } = data;

    if (!projectId) {
      socket.emit("error", { message: "projectId is required" });
      return;
    }

    try {
      // Verify project membership
      const project = await Project.findById(projectId);
      if (!project) {
        socket.emit("error", { message: "Project not found" });
        return;
      }

      const isMember = project.members.some(
        (m) => m.user && m.user.toString() === userId.toString()
      );

      if (!isMember) {
        socket.emit("error", { message: "Not a project member" });
        return;
      }

      socket.join(`project:${projectId}`);
      socket.join(`tasks:${projectId}`);

      console.log(
        `[TaskSocket] Socket ${socket.id} joined project tasks room: ${projectId}`
      );

      socket.emit("joinedProjectTasks", { projectId });
    } catch (error) {
      console.error("[TaskSocket] Error joining project tasks:", error);
      socket.emit("error", { message: "Failed to join project tasks" });
    }
  });

  /**
   * Leave project tasks room
   */
  socket.on("leaveProjectTasks", (data) => {
    const { projectId } = data;
    socket.leave(`project:${projectId}`);
    socket.leave(`tasks:${projectId}`);
    console.log(
      `[TaskSocket] Socket ${socket.id} left project tasks room: ${projectId}`
    );
  });

  /**
   * Join specific task room (for focused updates, comments, activity)
   */
  socket.on("joinTask", async (data) => {
    const { taskId } = data;

    if (!taskId) {
      socket.emit("error", { message: "taskId is required" });
      return;
    }

    try {
      const task = await Task.findById(taskId);
      if (!task) {
        socket.emit("error", { message: "Task not found" });
        return;
      }

      // Verify project membership
      const project = await Project.findById(task.projectId);
      if (!project) {
        socket.emit("error", { message: "Project not found" });
        return;
      }

      const isMember = project.members.some(
        (m) => m.user && m.user.toString() === userId.toString()
      );

      if (!isMember) {
        socket.emit("error", { message: "Not a project member" });
        return;
      }

      socket.join(`task:${taskId}`);
      console.log(`[TaskSocket] Socket ${socket.id} joined task room: ${taskId}`);

      socket.emit("joinedTask", { taskId });
    } catch (error) {
      console.error("[TaskSocket] Error joining task:", error);
      socket.emit("error", { message: "Failed to join task" });
    }
  });

  /**
   * Leave task room
   */
  socket.on("leaveTask", (data) => {
    const { taskId } = data;
    socket.leave(`task:${taskId}`);
    console.log(`[TaskSocket] Socket ${socket.id} left task room: ${taskId}`);
  });

  /**
   * Real-time task move (drag & drop)
   * Validates and executes task movement with reordering
   */
  socket.on("task:move", async (data) => {
    const { taskId, toStatus, toOrderKey, requirePRForReview, requireMergedPRForDone } = data;

    if (!taskId || !toStatus) {
      socket.emit("task:move:error", {
        message: "taskId and toStatus are required",
      });
      return;
    }

    try {
      const task = await Task.findById(taskId);
      if (!task) {
        socket.emit("task:move:error", { message: "Task not found" });
        return;
      }

      // Verify project membership
      const project = await Project.findById(task.projectId);
      if (!project) {
        socket.emit("task:move:error", { message: "Project not found" });
        return;
      }

      const isMember = project.members.some(
        (m) => m.user && m.user.toString() === userId.toString()
      );

      if (!isMember) {
        socket.emit("task:move:error", { message: "Not authorized" });
        return;
      }

      // Get user object for taskService
      const user = { id: userId };

      const options = {
        requirePRForReview: requirePRForReview !== false,
        requireMergedPRForDone: requireMergedPRForDone === true,
      };

      const { task: movedTask, fromStatus, toStatus: newStatus } =
        await taskService.moveTaskAcrossColumns(
          user,
          taskId,
          toStatus,
          toOrderKey,
          options
        );

      // Broadcast to all project members
      io.to(`project:${task.projectId}`).emit("task:moved", {
        taskId: movedTask._id,
        task: movedTask,
        fromStatus,
        toStatus: newStatus,
        orderKey: movedTask.orderKey,
        movedBy: userId,
      });

      socket.emit("task:move:success", {
        task: movedTask,
        fromStatus,
        toStatus: newStatus,
      });

      console.log(
        `[TaskSocket] Task ${taskId} moved from ${fromStatus} to ${newStatus} by user ${userId}`
      );
    } catch (error) {
      console.error("[TaskSocket] Error moving task:", error);
      socket.emit("task:move:error", { message: error.message });
    }
  });

  /**
   * Typing indicator for task comments
   */
  socket.on("task:typing", (data) => {
    const { taskId, userName } = data;
    if (!taskId) return;

    socket.to(`task:${taskId}`).emit("task:typing", {
      taskId,
      userId,
      userName,
    });
  });

  /**
   * Stop typing indicator
   */
  socket.on("task:stop_typing", (data) => {
    const { taskId } = data;
    if (!taskId) return;

    socket.to(`task:${taskId}`).emit("task:stop_typing", {
      taskId,
      userId,
    });
  });

  /**
   * Quick assign (assign current user to task)
   */
  socket.on("task:quick_assign", async (data) => {
    const { taskId } = data;

    if (!taskId) {
      socket.emit("task:assign:error", { message: "taskId is required" });
      return;
    }

    try {
      const task = await Task.findById(taskId);
      if (!task) {
        socket.emit("task:assign:error", { message: "Task not found" });
        return;
      }

      // Verify project membership
      const project = await Project.findById(task.projectId);
      if (!project) {
        socket.emit("task:assign:error", { message: "Project not found" });
        return;
      }

      const isMember = project.members.some(
        (m) => m.user && m.user.toString() === userId.toString()
      );

      if (!isMember) {
        socket.emit("task:assign:error", { message: "Not authorized" });
        return;
      }

      // Add user to assignees if not already assigned
      if (!task.assignees.includes(userId)) {
        task.assignees.push(userId);
        task.addActivity(userId, "assigned", {
          added: [userId],
          removed: [],
        });
        await task.save();

        await task.populate([
          { path: "assignees", select: "username email avatar" },
          { path: "createdBy", select: "username email avatar" },
        ]);

        // Broadcast update
        io.to(`project:${task.projectId}`).emit("task:updated", {
          task,
          changedFields: ["assignees"],
          actorId: userId,
        });

        socket.emit("task:assign:success", { task });

        console.log(`[TaskSocket] User ${userId} self-assigned to task ${taskId}`);
      } else {
        socket.emit("task:assign:success", {
          task,
          message: "Already assigned",
        });
      }
    } catch (error) {
      console.error("[TaskSocket] Error in quick assign:", error);
      socket.emit("task:assign:error", { message: error.message });
    }
  });

  /**
   * Handle disconnection
   */
  socket.on("disconnect", () => {
    console.log(`[TaskSocket] User ${userId} disconnected from task sockets`);
  });
};

/**
 * Server-side event emitters (called from controllers/services)
 * These should be imported and used in taskController.js
 */

/**
 * Emit task created event
 */
function emitTaskCreated(io, projectId, task) {
  io.to(`project:${projectId}`).emit("task:created", { task });
}

/**
 * Emit task updated event
 */
function emitTaskUpdated(io, projectId, task, changedFields, actorId) {
  io.to(`project:${projectId}`).emit("task:updated", {
    task,
    changedFields,
    actorId,
  });
  io.to(`task:${task._id}`).emit("task:updated", {
    task,
    changedFields,
    actorId,
  });
}

/**
 * Emit task deleted event
 */
function emitTaskDeleted(io, projectId, taskId) {
  io.to(`project:${projectId}`).emit("task:deleted", { taskId });
  io.to(`task:${taskId}`).emit("task:deleted", { taskId });
}

/**
 * Emit task comment event
 */
function emitTaskComment(io, projectId, taskId, comment) {
  io.to(`project:${projectId}`).emit("task:comment", {
    taskId,
    comment,
  });
  io.to(`task:${taskId}`).emit("task:comment", {
    taskId,
    comment,
  });
}

/**
 * Emit task assigned event (for notifications)
 */
function emitTaskAssigned(io, projectId, taskId, assignees, assignedBy) {
  io.to(`project:${projectId}`).emit("task:assigned", {
    taskId,
    assignees,
    assignedBy,
  });

  // Send personal notification to each assignee
  assignees.forEach((assigneeId) => {
    if (assigneeId.toString() !== assignedBy.toString()) {
      io.to(`user:${assigneeId}`).emit("notification", {
        type: "task_assigned",
        taskId,
      });
    }
  });
}

/**
 * Emit bulk task update event
 */
function emitBulkTaskUpdate(io, projectId, tasks) {
  io.to(`project:${projectId}`).emit("task:bulk_updated", {
    tasks,
  });
}

module.exports.emitTaskCreated = emitTaskCreated;
module.exports.emitTaskUpdated = emitTaskUpdated;
module.exports.emitTaskDeleted = emitTaskDeleted;
module.exports.emitTaskComment = emitTaskComment;
module.exports.emitTaskAssigned = emitTaskAssigned;
module.exports.emitBulkTaskUpdate = emitBulkTaskUpdate;
