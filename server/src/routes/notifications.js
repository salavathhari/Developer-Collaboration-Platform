const express = require("express");

const { authenticate } = require("../middleware/auth");
const {
  getNotifications,
  markNotificationRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/", authenticate, getNotifications);
router.patch("/:id/read", authenticate, markNotificationRead);

module.exports = router;
