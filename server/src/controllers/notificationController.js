const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");

const getNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const notifications = await Notification.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit);

  const unreadCount = await Notification.countDocuments({
    userId: req.user.id,
    read: false,
  });

  return res.status(200).json({ notifications, unreadCount });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await Notification.findOneAndUpdate(
    { _id: id, userId: req.user.id },
    { read: true },
    { new: true }
  );

  return res.status(200).json({ notification });
});

module.exports = {
  getNotifications,
  markNotificationRead,
};
