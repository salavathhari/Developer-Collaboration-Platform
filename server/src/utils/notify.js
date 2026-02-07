const Notification = require("../models/Notification");

const createNotification = async ({ userId, type, projectId, payload }) => {
  const notification = await Notification.create({
    userId,
    type,
    projectId: projectId || null,
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
