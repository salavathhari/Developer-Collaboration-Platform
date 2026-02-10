const mongoose = require("mongoose");
const Task = require("../models/Task");
const PullRequest = require("../models/PullRequest");
const File = require("../models/File");
const Notification = require("../models/Notification");
const { logActivity } = require("../utils/activity");

/**
 * Business logic layer for task management
 * Handles complex operations, validations, and side effects
 */

class TaskService {
  /**
   * Create a new task with proper initialization
   */
  async createTask(user, projectId, payload) {
    const {
      title,
      description = "",
      status = "todo",
      priority = "medium",
      assignees = [],
      dueDate,
      labels = [],
      columnId,
      linkedPRId,
      linkedIssueId,
    } = payload;

    // Validation
    if (!title || title.trim().length === 0) {
      throw new Error("Task title is required");
    }

    if (title.length > 200) {
      throw new Error("Task title cannot exceed 200 characters");
    }

    // Calculate orderKey - get max orderKey in the target status/column
    const maxTask = await Task.findOne({ projectId, status })
      .sort({ orderKey: -1 })
      .select("orderKey");

    const orderKey = maxTask ? maxTask.orderKey + 1000 : 1000;

    // Create task
    const task = await Task.create({
      projectId,
      title: title.trim(),
      description,
      status,
      priority,
      assignees,
      dueDate,
      labels,
      columnId,
      linkedPRId,
      linkedIssueId,
      createdBy: user.id,
      orderKey,
      order: orderKey, // backward compatibility
    });

    // Add activity
    task.addActivity(user.id, "created", { title });
    await task.save();

    // Populate references
    await task.populate([
      { path: "createdBy", select: "username email avatar" },
      { path: "assignees", select: "username email avatar" },
      { path: "linkedPRId", select: "number title status" },
      { path: "linkedIssueId", select: "title status" },
    ]);

    // Create notifications for assignees
    await this._notifyAssignees(task, user.id, "assigned");

    // Log activity
    logActivity(projectId, user.id, "created_task", `Created task: ${title}`);

    return task;
  }

  /**
   * Update task with validation and side effects
   */
  async updateTask(user, taskId, updates, options = {}) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
      "labels",
      "assignees",
      "columnId",
      "orderKey",
    ];

    const changedFields = [];

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && task[key] !== value) {
        // Handle status change with validation
        if (key === "status" && value !== task.status) {
          await task.moveToStatus(value, options);
          task.addActivity(user.id, "status_changed", {
            from: task.status,
            to: value,
          });
          changedFields.push("status");
        } else {
          task[key] = value;
          changedFields.push(key);
        }
      }
    }

    // Handle assignee changes
    if (updates.assignees && !this._arrayEquals(task.assignees, updates.assignees)) {
      const oldAssignees = task.assignees.map((a) => a.toString());
      const newAssignees = updates.assignees.map((a) => a.toString());
      const added = newAssignees.filter((a) => !oldAssignees.includes(a));
      const removed = oldAssignees.filter((a) => !newAssignees.includes(a));

      if (added.length > 0 || removed.length > 0) {
        task.addActivity(user.id, "assigned", { added, removed });
        changedFields.push("assignees");

        // Notify new assignees
        for (const assigneeId of added) {
          if (assigneeId !== user.id.toString()) {
            await Notification.create({
              userId: assigneeId,
              type: "task_assigned",
              message: `You were assigned to task: ${task.title}`,
              referenceId: task._id,
              projectId: task.projectId,
              payload: { taskTitle: task.title },
            });
          }
        }
      }
    }

    if (changedFields.length > 0) {
      task.addActivity(user.id, "updated", { fields: changedFields });
    }

    await task.save();

    await task.populate([
      { path: "createdBy", select: "username email avatar" },
      { path: "assignees", select: "username email avatar" },
      { path: "assignedTo", select: "username email avatar" },
      { path: "linkedPRId", select: "number title status" },
      { path: "linkedIssueId", select: "title status" },
      { path: "comments.userId", select: "username email avatar" },
      { path: "linkedFiles", select: "name size path" },
    ]);

    // Additional side effects based on status change
    if (updates.status && updates.status !== task.status) {
      await this._handleStatusChangeEffects(task, user, updates.status);
    }

    logActivity(
      task.projectId,
      user.id,
      "updated_task",
      `Updated task: ${task.title}`
    );

    return { task, changedFields };
  }

  /**
   * Link a pull request to a task
   */
  async linkPR(user, taskId, prId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    await task.linkPR(prId);
    task.addActivity(user.id, "pr_linked", { prId });
    await task.save();

    await task.populate([
      { path: "linkedPRId", select: "number title status author reviewers" },
      { path: "createdBy assignees", select: "username email avatar" },
    ]);

    // Notify assignees and PR reviewers
    const pr = await PullRequest.findById(prId);
    if (pr) {
      const notifyUsers = [
        ...task.assignees.map((a) => a._id.toString()),
        ...(pr.reviewers || []).map((r) => r.toString()),
      ];

      const uniqueUsers = [...new Set(notifyUsers)].filter(
        (uid) => uid !== user.id.toString()
      );

      for (const userId of uniqueUsers) {
        await Notification.create({
          userId,
          type: "task_pr_linked",
          message: `PR #${pr.number} was linked to task: ${task.title}`,
          referenceId: task._id,
          projectId: task.projectId,
          payload: { taskTitle: task.title, prNumber: pr.number },
        });
      }
    }

    logActivity(
      task.projectId,
      user.id,
      "linked_pr_to_task",
      `Linked PR to task: ${task.title}`
    );

    return task;
  }

  /**
   * Link a file to a task
   */
  async linkFile(user, taskId, fileId) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const file = await File.findById(fileId);
    if (!file) {
      throw new Error("File not found");
    }

    await task.linkFile(fileId);
    task.addActivity(user.id, "file_linked", { fileId, fileName: file.name });
    await task.save();

    await task.populate([
      { path: "linkedFiles", select: "name size path uploadedBy" },
      { path: "assignees", select: "username email avatar" },
    ]);

    // Notify assignees
    await this._notifyAssignees(task, user.id, "file_linked", {
      fileName: file.name,
    });

    logActivity(
      task.projectId,
      user.id,
      "linked_file_to_task",
      `Linked file ${file.name} to task: ${task.title}`
    );

    return task;
  }

  /**
   * Move task across columns/statuses with reordering
   */
  async moveTaskAcrossColumns(user, taskId, toStatus, toOrderKey, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const task = await Task.findById(taskId).session(session);
      if (!task) {
        throw new Error("Task not found");
      }

      const fromStatus = task.status;
      const fromOrderKey = task.orderKey;

      // Validate status transition
      await task.moveToStatus(toStatus, options);

      // Calculate new orderKey
      let finalOrderKey = toOrderKey;
      if (toOrderKey === undefined || toOrderKey === null) {
        // Place at the end of the target column
        const maxTask = await Task.findOne({
          projectId: task.projectId,
          status: toStatus,
        })
          .sort({ orderKey: -1 })
          .select("orderKey")
          .session(session);

        finalOrderKey = maxTask ? maxTask.orderKey + 1000 : 1000;
      }

      task.orderKey = finalOrderKey;
      task.order = finalOrderKey; // backward compatibility
      task.addActivity(user.id, "moved", {
        fromStatus,
        toStatus,
        fromOrderKey,
        toOrderKey: finalOrderKey,
      });

      await task.save({ session });

      // Reorder other tasks if necessary
      if (toOrderKey !== undefined) {
        await this._reorderTasks(
          task.projectId,
          toStatus,
          toOrderKey,
          task._id,
          session
        );
      }

      await session.commitTransaction();

      await task.populate([
        { path: "createdBy", select: "username email avatar" },
        { path: "assignees", select: "username email avatar" },
        { path: "linkedPRId", select: "number title status" },
      ]);

      // Handle side effects
      await this._handleStatusChangeEffects(task, user, toStatus);

      logActivity(
        task.projectId,
        user.id,
        "moved_task",
        `Moved task "${task.title}" from ${fromStatus} to ${toStatus}`
      );

      return { task, fromStatus, toStatus };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Bulk update multiple tasks
   */
  async bulkUpdateTasks(user, projectId, taskIds, updates) {
    const results = {
      successful: [],
      failed: [],
    };

    for (const taskId of taskIds) {
      try {
        const { task } = await this.updateTask(user, taskId, updates);
        results.successful.push({
          taskId,
          task,
        });
      } catch (error) {
        results.failed.push({
          taskId,
          error: error.message,
        });
      }
    }

    logActivity(
      projectId,
      user.id,
      "bulk_updated_tasks",
      `Bulk updated ${results.successful.length} tasks`
    );

    return results;
  }

  /**
   * Add comment to task
   */
  async addComment(user, taskId, text) {
    const task = await Task.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const comment = {
      userId: user.id,
      text: text.trim(),
      createdAt: new Date(),
    };

    task.comments.push(comment);
    task.commentsCount = task.comments.length;
    task.addActivity(user.id, "comment_added", { commentText: text.substring(0, 100) });
    await task.save();

    await task.populate([
      { path: "comments.userId", select: "username email avatar" },
      { path: "assignees", select: "username email avatar" },
    ]);

    // Notify assignees (except commenter)
    await this._notifyAssignees(task, user.id, "comment_added", {
      commenterName: user.name || user.username,
    });

    return task;
  }

  // Private helper methods

  async _notifyAssignees(task, actorId, notificationType, extraPayload = {}) {
    const assigneeIds = task.assignees.map((a) =>
      typeof a === "object" ? a._id.toString() : a.toString()
    );

    const notificationMessages = {
      assigned: `You were assigned to task: ${task.title}`,
      file_linked: `A file was attached to task: ${task.title}`,
      comment_added: `New comment on task: ${task.title}`,
      status_changed: `Task status changed: ${task.title}`,
    };

    for (const assigneeId of assigneeIds) {
      if (assigneeId !== actorId.toString()) {
        await Notification.create({
          userId: assigneeId,
          type: `task_${notificationType}`,
          message: notificationMessages[notificationType] || `Task updated: ${task.title}`,
          referenceId: task._id,
          projectId: task.projectId,
          payload: {
            taskTitle: task.title,
            ...extraPayload,
          },
        });
      }
    }
  }

  async _handleStatusChangeEffects(task, user, newStatus) {
    if (newStatus === "done") {
      // Task completed - log analytics event
      logActivity(
        task.projectId,
        user.id,
        "completed_task",
        `Completed task: ${task.title}`
      );

      // Notify all stakeholders
      const notifyUsers = new Set([
        ...task.assignees.map((a) => a._id.toString()),
        task.createdBy.toString(),
      ]);

      notifyUsers.delete(user.id.toString());

      for (const userId of notifyUsers) {
        await Notification.create({
          userId,
          type: "task_completed",
          message: `Task completed: ${task.title}`,
          referenceId: task._id,
          projectId: task.projectId,
          payload: { taskTitle: task.title },
        });
      }
    } else if (newStatus === "review" && task.linkedPRId) {
      // Notify PR reviewers
      const pr = await PullRequest.findById(task.linkedPRId);
      if (pr && pr.reviewers && pr.reviewers.length > 0) {
        for (const reviewerId of pr.reviewers) {
          await Notification.create({
            userId: reviewerId,
            type: "task_moved_to_review",
            message: `Task "${task.title}" is ready for review`,
            referenceId: task._id,
            projectId: task.projectId,
            payload: { taskTitle: task.title, prNumber: pr.number },
          });
        }
      }
    }
  }

  async _reorderTasks(projectId, status, insertOrderKey, excludeTaskId, session) {
    // Find tasks that need reordering (those after the insertion point)
    const tasksToShift = await Task.find({
      projectId,
      status,
      orderKey: { $gte: insertOrderKey },
      _id: { $ne: excludeTaskId },
    })
      .sort({ orderKey: 1 })
      .session(session);

    // Shift tasks down by 1000
    for (const t of tasksToShift) {
      t.orderKey += 1000;
      t.order = t.orderKey;
      await t.save({ session });
    }
  }

  _arrayEquals(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    const set1 = new Set(arr1.map((a) => a.toString()));
    const set2 = new Set(arr2.map((a) => a.toString()));
    return set1.size === set2.size && [...set1].every((val) => set2.has(val));
  }
}

module.exports = new TaskService();
