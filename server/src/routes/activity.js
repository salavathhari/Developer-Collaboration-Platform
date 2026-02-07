const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const { getProjectActivity } = require("../controllers/activityController");

const router = express.Router({ mergeParams: true });

router.get("/", authenticate, requireProjectMember, getProjectActivity);

module.exports = router;
