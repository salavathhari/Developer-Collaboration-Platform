const Notification = require("../models/Notification");

const createNotification = async ({ userId, type, message, projectId, referenceId, payload }) => {
  const notification = await Notification.create({
    userId,
    type,
    message: message || "New notification",
    projectId: projectId || null,
    referenceId: referenceId || null,
    payload: payload || {},
  });

  return notification;
};

const emitNotification = (io, notification) => {
  if (!io || !notification) {
    return;
  }

  io.to(`user:${notification.userId}`).emit("notification", notification);
};

module.exports = {
  createNotification,
  emitNotification,
};
