const express = require("express");

const { authenticate } = require("../middleware/auth");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/", authenticate, getNotifications);
router.patch("/read-all", authenticate, markAllNotificationsRead);
router.patch("/:id/read", authenticate, markNotificationRead);

module.exports = router;
