const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const { getMessages, createMessage } = require("../controllers/messageController");

const router = express.Router({ mergeParams: true });

router.get("/", authenticate, requireProjectMember, getMessages);
router.post("/", authenticate, requireProjectMember, createMessage);

module.exports = router;
