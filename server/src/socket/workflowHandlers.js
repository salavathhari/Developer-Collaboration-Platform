const PullRequest = require("../models/PullRequest");
const Task = require("../models/Task");
const Notification = require("../models/Notification");

/**
 * Socket.IO handlers for Structured Development Workflow
 * Manages real-time events for PRs, tasks, and workflow activity
 */
module.exports = (io, socket, userId) => {
  // Join project room for workflow events
  socket.on("workflow:join_project", (projectId) => {
    socket.join(`project:${projectId}`);
    console.log(`[WorkflowSocket] Socket ${socket.id} joined project:${projectId}`);
  });

  // Leave project room
  socket.on("workflow:leave_project", (projectId) => {
    socket.leave(`project:${projectId}`);
    console.log(`[WorkflowSocket] Socket ${socket.id} left project:${projectId}`);
  });

  // Join PR room
  socket.on("workflow:join_pr", (prId) => {
    socket.join(`pr:${prId}`);
    console.log(`[WorkflowSocket] Socket ${socket.id} joined pr:${prId}`);
  });

  // Leave PR room
  socket.on("workflow:leave_pr", (prId) => {
    socket.leave(`pr:${prId}`);
    console.log(`[WorkflowSocket] Socket ${socket.id} left pr:${prId}`);
  });

  // Join task room
  socket.on("workflow:join_task", (taskId) => {
    socket.join(`task:${taskId}`);
    console.log(`[WorkflowSocket] Socket ${socket.id} joined task:${taskId}`);
  });

  // Leave task room
  socket.on("workflow:leave_task", (taskId) => {
    socket.leave(`task:${taskId}`);
    console.log(`[WorkflowSocket] Socket ${socket.id} left task:${taskId}`);
  });

  // PR Created Event - broadcast to project room
  socket.on("workflow:pr_created", async (data) => {
    const { projectId, prId } = data;
    try {
      const pr = await PullRequest.findById(prId)
        .populate("author", "username email avatar")
        .populate("reviewers", "username email avatar");
      
      if (pr) {
        io.to(`project:${projectId}`).emit("workflow:pr_created", pr);
        console.log(`[WorkflowSocket] PR created broadcast to project:${projectId}`);
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting PR creation:", error);
    }
  });

  // PR Updated Event
  socket.on("workflow:pr_updated", async (data) => {
    const { projectId, prId } = data;
    try {
      const pr = await PullRequest.findById(prId)
        .populate("author", "username email avatar")
        .populate("reviewers", "username email avatar")
        .populate("approvals.userId", "username email avatar");
      
      if (pr) {
        io.to(`project:${projectId}`).emit("workflow:pr_updated", pr);
        io.to(`pr:${prId}`).emit("workflow:pr_updated", pr);
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting PR update:", error);
    }
  });

  // PR Approved Event
  socket.on("workflow:pr_approved", async (data) => {
    const { projectId, prId, approverId, approverName } = data;
    try {
      const pr = await PullRequest.findById(prId);
      if (pr) {
        io.to(`project:${projectId}`).emit("workflow:pr_approved", {
          prId,
          prNumber: pr.number,
          prTitle: pr.title,
          approverId,
          approverName
        });
        io.to(`pr:${prId}`).emit("workflow:pr_approved", {
          approverId,
          approverName
        });
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting PR approval:", error);
    }
  });

  // PR Merged Event
  socket.on("workflow:pr_merged", async (data) => {
    const { projectId, prId, mergedBy, mergedByName } = data;
    try {
      const pr = await PullRequest.findById(prId)
        .populate("author", "username email avatar")
        .populate("mergedBy", "username email avatar");
      
      if (pr) {
        io.to(`project:${projectId}`).emit("workflow:pr_merged", {
          pr,
          mergedBy,
          mergedByName
        });
        io.to(`pr:${prId}`).emit("workflow:pr_merged", {
          mergedBy,
          mergedByName
        });
        
        // Notify about auto-completed linked tasks
        const completedTasks = await Task.find({
          linkedPRId: prId,
          status: "done"
        });
        
        if (completedTasks.length > 0) {
          io.to(`project:${projectId}`).emit("workflow:tasks_auto_completed", {
            prId,
            prNumber: pr.number,
            taskIds: completedTasks.map(t => t._id),
            count: completedTasks.length
          });
        }
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting PR merge:", error);
    }
  });

  // PR Blocked Event (merge conflict)
  socket.on("workflow:pr_blocked", async (data) => {
    const { projectId, prId, conflicts } = data;
    try {
      io.to(`project:${projectId}`).emit("workflow:pr_blocked", {
        prId,
        conflicts
      });
      io.to(`pr:${prId}`).emit("workflow:pr_blocked", {
        conflicts
      });
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting PR block:", error);
    }
  });

  // Task Created Event
  socket.on("workflow:task_created", async (data) => {
    const { projectId, taskId } = data;
    try {
      const task = await Task.findById(taskId)
        .populate("assignedTo assignees createdBy", "username email avatar")
        .populate("linkedPRId", "number title status");
      
      if (task) {
        io.to(`project:${projectId}`).emit("workflow:task_created", task);
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting task creation:", error);
    }
  });

  // Task Updated Event
  socket.on("workflow:task_updated", async (data) => {
    const { projectId, taskId, oldStatus, newStatus } = data;
    try {
      const task = await Task.findById(taskId)
        .populate("assignedTo assignees createdBy", "username email avatar")
        .populate("linkedPRId", "number title status");
      
      if (task) {
        io.to(`project:${projectId}`).emit("workflow:task_updated", {
          task,
          oldStatus,
          newStatus
        });
        io.to(`task:${taskId}`).emit("workflow:task_updated", {
          task,
          oldStatus,
          newStatus
        });
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting task update:", error);
    }
  });

  // Task Linked to PR Event
  socket.on("workflow:task_linked_to_pr", async (data) => {
    const { projectId, taskId, prId } = data;
    try {
      const task = await Task.findById(taskId)
        .populate("linkedPRId", "number title status");
      const pr = await PullRequest.findById(prId);
      
      if (task && pr) {
        io.to(`project:${projectId}`).emit("workflow:task_linked_to_pr", {
          taskId,
          taskTitle: task.title,
          prId,
          prNumber: pr.number,
          prTitle: pr.title
        });
        io.to(`task:${taskId}`).emit("workflow:task_linked_to_pr", {
          prId,
          prNumber: pr.number,
          prTitle: pr.title
        });
        io.to(`pr:${prId}`).emit("workflow:task_linked", {
          taskId,
          taskTitle: task.title
        });
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting task-PR link:", error);
    }
  });

  // Task Moved to Review (notifies PR reviewers)
  socket.on("workflow:task_moved_to_review", async (data) => {
    const { projectId, taskId, taskTitle, prId } = data;
    try {
      const pr = await PullRequest.findById(prId)
        .populate("reviewers", "username email avatar");
      
      if (pr) {
        // Notify reviewers
        io.to(`project:${projectId}`).emit("workflow:task_moved_to_review", {
          taskId,
          taskTitle,
          prId,
          prNumber: pr.number
        });
        io.to(`pr:${prId}`).emit("workflow:task_moved_to_review", {
          taskId,
          taskTitle
        });
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error broadcasting task review:", error);
    }
  });

  // Task Drag and Drop / Reorder Event
  socket.on("workflow:task_reordered", (data) => {
    const { projectId, taskId, sourceColumnId, destColumnId, newOrder } = data;
    io.to(`project:${projectId}`).emit("workflow:task_reordered", {
      taskId,
      sourceColumnId,
      destColumnId,
      newOrder
    });
  });

  // Notification Event (generic workflow notifications)
  socket.on("workflow:notification", async (data) => {
    const { userId, notificationId } = data;
    try {
      const notification = await Notification.findById(notificationId);
      if (notification) {
        io.to(`user:${userId}`).emit("workflow:notification", notification);
      }
    } catch (error) {
      console.error("[WorkflowSocket] Error sending notification:", error);
    }
  });
};
