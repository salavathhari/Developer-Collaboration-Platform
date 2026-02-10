const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticate } = require("../middleware/auth");

// All routes require authentication
router.use(authenticate);

// Send message
router.post("/send", chatController.sendMessage);

// Get chat history
router.get("/history", chatController.getChatHistory);

// Mark messages as read
router.post("/read", chatController.markMessagesRead);

// Delete message
router.delete("/:messageId", chatController.deleteMessage);

// Edit message
router.put("/:messageId", chatController.editMessage);

module.exports = router;
