const express = require("express");
const { authenticate } = require("../middleware/auth");
const { getTasksByQuery } = require("../controllers/taskController");

const router = express.Router();

router.get("/", authenticate, getTasksByQuery);

module.exports = router;
