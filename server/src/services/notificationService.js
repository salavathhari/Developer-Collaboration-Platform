const Notification = require("../models/Notification");
const User = require("../models/User");
const { sendEmail } = require("../utils/email");

/**
 * Unified Notification Service
 * Handles all notification creation and delivery across the platform
 */

class NotificationService {
  constructor(io = null) {
    this.io = io;
  }

  /**
   * Set Socket.io instance for real-time notifications
   */
  setIO(io) {
    this.io = io;
  }

  /**
   * Core method to create and emit notifications
   */
  async createNotification({ userId, type, message, projectId, referenceId, payload }) {
    try {
      const notification = await Notification.create({
        userId,
        type,
        message,
        projectId: projectId || null,
        referenceId: referenceId || null,
        payload: payload || {},
      });

      // Emit real-time notification via Socket.io
      if (this.io) {
        this.io.to(`user:${userId}`).emit("notification", {
          id: notification._id,
          type: notification.type,
          message: notification.message,
          projectId: notification.projectId,
          referenceId: notification.referenceId,
          payload: notification.payload,
          read: false,
          createdAt: notification.createdAt,
        });
      }

      return notification;
    } catch (error) {
      console.error("[NotificationService] Failed to create notification:", error);
      return null;
    }
  }

  /**
   * Send notification with optional email fallback
   */
  async notify({ userId, type, message, projectId, referenceId, payload, emailFallback = false }) {
    const notification = await this.createNotification({
      userId,
      type,
      message,
      projectId,
      referenceId,
      payload,
    });

    // Send email fallback if enabled
    if (emailFallback && notification) {
      try {
        const user = await User.findById(userId).select("email name");
        if (user && user.email) {
          await this.sendNotificationEmail(user, type, message, payload);
        }
      } catch (error) {
        console.error("[NotificationService] Email fallback failed:", error);
      }
    }

    return notification;
  }

  /**
   * Notify multiple users at once
   */
  async notifyMany(notifications) {
    const results = await Promise.allSettled(
      notifications.map((notif) => this.notify(notif))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    console.log(`[NotificationService] Sent ${successful}/${notifications.length} notifications`);

    return results;
  }

  /**
   * Task-related notifications
   */
  async notifyTaskAssigned({ taskId, taskTitle, assigneeIds, assignedBy, projectId }) {
    const assignedByUser = await User.findById(assignedBy).select("name");
    const assignerName = assignedByUser?.name || "Someone";

    return this.notifyMany(
      assigneeIds.map((userId) => ({
        userId,
        type: "task_assigned",
        message: `${assignerName} assigned you to task: ${taskTitle}`,
        projectId,
        referenceId: taskId,
        payload: { taskId, taskTitle, assignedBy },
        emailFallback: true,
      }))
    );
  }

  async notifyTaskStatusChanged({ taskId, taskTitle, newStatus, changedBy, projectId, watchers = [] }) {
    const changedByUser = await User.findById(changedBy).select("name");
    const changerName = changedByUser?.name || "Someone";

    return this.notifyMany(
      watchers
        .filter((userId) => userId.toString() !== changedBy.toString())
        .map((userId) => ({
          userId,
          type: "task_status_changed",
          message: `${changerName} moved "${taskTitle}" to ${newStatus.replace("_", " ").toUpperCase()}`,
          projectId,
          referenceId: taskId,
          payload: { taskId, taskTitle, newStatus, changedBy },
        }))
    );
  }

  async notifyTaskComment({ taskId, taskTitle, commenterId, comment, projectId, watchers = [] }) {
    const commenterUser = await User.findById(commenterId).select("name");
    const commenterName = commenterUser?.name || "Someone";

    return this.notifyMany(
      watchers
        .filter((userId) => userId.toString() !== commenterId.toString())
        .map((userId) => ({
          userId,
          type: "task_comment",
          message: `${commenterName} commented on "${taskTitle}"`,
          projectId,
          referenceId: taskId,
          payload: { taskId, taskTitle, commenterId, comment },
        }))
    );
  }

  /**
   * Pull Request notifications
   */
  async notifyPRCreated({ prId, prNumber, prTitle, authorId, projectId, reviewers = [] }) {
    const author = await User.findById(authorId).select("name");
    const authorName = author?.name || "Someone";

    return this.notifyMany(
      reviewers
        .filter((userId) => userId.toString() !== authorId.toString())
        .map((userId) => ({
          userId,
          type: "pr_created",
          message: `${authorName} created PR #${prNumber}: ${prTitle}`,
          projectId,
          referenceId: prId,
          payload: { prId, prNumber, prTitle, authorId },
          emailFallback: true,
        }))
    );
  }

  async notifyPRReviewRequested({ prId, prNumber, prTitle, requesterId, reviewerId, projectId }) {
    const requester = await User.findById(requesterId).select("name");
    const requesterName = requester?.name || "Someone";

    return this.notify({
      userId: reviewerId,
      type: "pr_review_requested",
      message: `${requesterName} requested your review on PR #${prNumber}: ${prTitle}`,
      projectId,
      referenceId: prId,
      payload: { prId, prNumber, prTitle, requesterId },
      emailFallback: true,
    });
  }

  async notifyPRApproved({ prId, prNumber, prTitle, approverId, authorId, projectId }) {
    if (approverId.toString() === authorId.toString()) return;

    const approver = await User.findById(approverId).select("name");
    const approverName = approver?.name || "Someone";

    return this.notify({
      userId: authorId,
      type: "pr_approved",
      message: `${approverName} approved your PR #${prNumber}: ${prTitle}`,
      projectId,
      referenceId: prId,
      payload: { prId, prNumber, prTitle, approverId },
    });
  }

  async notifyPRMerged({ prId, prNumber, prTitle, mergerId, authorId, projectId, watchers = [] }) {
    const merger = await User.findById(mergerId).select("name");
    const mergerName = merger?.name || "Someone";

    const uniqueWatchers = [...new Set([...watchers, authorId])].filter(
      (userId) => userId.toString() !== mergerId.toString()
    );

    return this.notifyMany(
      uniqueWatchers.map((userId) => ({
        userId,
        type: "pr_merged",
        message: `${mergerName} merged PR #${prNumber}: ${prTitle}`,
        projectId,
        referenceId: prId,
        payload: { prId, prNumber, prTitle, mergerId },
      }))
    );
  }

  async notifyPRComment({ prId, prNumber, prTitle, commenterId, comment, projectId, watchers = [] }) {
    const commenter = await User.findById(commenterId).select("name");
    const commenterName = commenter?.name || "Someone";

    return this.notifyMany(
      watchers
        .filter((userId) => userId.toString() !== commenterId.toString())
        .map((userId) => ({
          userId,
          type: "pr_comment",
          message: `${commenterName} commented on PR #${prNumber}: ${prTitle}`,
          projectId,
          referenceId: prId,
          payload: { prId, prNumber, prTitle, commenterId, comment },
        }))
    );
  }

  /**
   * Project/Member notifications
   */
  async notifyProjectInvite({ projectId, projectName, inviteeEmail, inviterId }) {
    const inviter = await User.findById(inviterId).select("name");
    const inviterName = inviter?.name || "Someone";

    // Check if user exists
    const inviteeUser = await User.findOne({ email: inviteeEmail });

    if (inviteeUser) {
      return this.notify({
        userId: inviteeUser._id,
        type: "project_invite",
        message: `${inviterName} invited you to join project: ${projectName}`,
        projectId,
        payload: { projectId, projectName, inviterId },
        emailFallback: true,
      });
    }

    // User doesn't exist - email will be sent by invite controller
    return null;
  }

  async notifyMemberJoined({ projectId, projectName, newMemberId, members = [] }) {
    const newMember = await User.findById(newMemberId).select("name");
    const newMemberName = newMember?.name || "Someone";

    return this.notifyMany(
      members
        .filter((userId) => userId.toString() !== newMemberId.toString())
        .map((userId) => ({
          userId,
          type: "member_joined",
          message: `${newMemberName} joined project: ${projectName}`,
          projectId,
          payload: { projectId, projectName, newMemberId },
        }))
    );
  }

  /**
   * File notifications
   */
  async notifyFileUploaded({ fileId, fileName, uploaderId, projectId, attachedTo, watchers = [] }) {
    const uploader = await User.findById(uploaderId).select("name");
    const uploaderName = uploader?.name || "Someone";

    let context = "";
    if (attachedTo?.type === "task") {
      context = ` to task "${attachedTo.title}"`;
    } else if (attachedTo?.type === "pr") {
      context = ` to PR #${attachedTo.number}`;
    }

    return this.notifyMany(
      watchers
        .filter((userId) => userId.toString() !== uploaderId.toString())
        .map((userId) => ({
          userId,
          type: "file_uploaded",
          message: `${uploaderName} uploaded "${fileName}"${context}`,
          projectId,
          referenceId: fileId,
          payload: { fileId, fileName, uploaderId, attachedTo },
        }))
    );
  }

  /**
   * Chat/Message notifications
   */
  async notifyMention({ messageId, mentionedUserId, mentionerId, projectId, messagePreview }) {
    const mentioner = await User.findById(mentionerId).select("name");
    const mentionerName = mentioner?.name || "Someone";

    return this.notify({
      userId: mentionedUserId,
      type: "mention",
      message: `${mentionerName} mentioned you: "${messagePreview}"`,
      projectId,
      referenceId: messageId,
      payload: { messageId, mentionerId, messagePreview },
    });
  }

  /**
   * Video Call notifications
   */
  async notifyVideoCallStarted({ meetingId, projectId, starterId, members = [] }) {
    const starter = await User.findById(starterId).select("name");
    const starterName = starter?.name || "Someone";

    return this.notifyMany(
      members
        .filter((userId) => userId.toString() !== starterId.toString())
        .map((userId) => ({
          userId,
          type: "video_call_started",
          message: `${starterName} started a video call`,
          projectId,
          referenceId: meetingId,
          payload: { meetingId, starterId },
          emailFallback: false, // Don't email for video calls
        }))
    );
  }

  /**
   * Send notification email
   */
  async sendNotificationEmail(user, type, message, payload) {
    const emailSubject = this.getEmailSubject(type);
    const emailHtml = this.getEmailTemplate(user.name, type, message, payload);

    try {
      await sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml,
      });
      console.log(`[NotificationService] Email sent to ${user.email} for ${type}`);
    } catch (error) {
      console.error(`[NotificationService] Failed to send email to ${user.email}:`, error);
    }
  }

  getEmailSubject(type) {
    const subjects = {
      task_assigned: "You've been assigned a new task",
      task_status_changed: "Task status updated",
      pr_created: "New pull request created",
      pr_review_requested: "Your review is requested",
      pr_approved: "Your pull request was approved",
      pr_merged: "Pull request merged",
      project_invite: "You've been invited to a project",
      file_uploaded: "New file uploaded",
      mention: "You were mentioned",
    };

    return subjects[type] || "New notification";
  }

  getEmailTemplate(userName, type, message, payload) {
    const clientUrl = process.env.CLIENT_ORIGIN || "http://localhost:5173";
    let actionUrl = clientUrl;
    
    // Build specific action URLs
    if (payload.projectId) {
      if (type.startsWith("task_")) {
        actionUrl = `${clientUrl}/projects/${payload.projectId}/tasks`;
      } else if (type.startsWith("pr_")) {
        actionUrl = `${clientUrl}/projects/${payload.projectId}/pull-requests`;
      } else {
        actionUrl = `${clientUrl}/projects/${payload.projectId}`;
      }
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 24px; }
          .content { padding: 30px; }
          .message { background: #f8f9fa; padding: 20px; border-left: 4px solid #8b5cf6; margin: 20px 0; }
          .button { display: inline-block; background: #8b5cf6; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; margin: 20px 0; }
          .footer { padding: 20px; background: #f8f9fa; text-align: center; font-size: 14px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 DevCollab Notification</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <div class="message">
              <strong>${message}</strong>
            </div>
            <div style="text-align: center;">
              <a href="${actionUrl}" class="button">View Details</a>
            </div>
          </div>
          <div class="footer">
            <p>You're receiving this because you're a member of DevCollab</p>
            <p>&copy; ${new Date().getFullYear()} DevCollab. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Export singleton instance
module.exports = new NotificationService();
