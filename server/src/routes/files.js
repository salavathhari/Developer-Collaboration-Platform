const express = require("express");

const { authenticate } = require("../middleware/auth");
const { requireProjectMember } = require("../middleware/projectAccess");
const { uploadProjectFile } = require("../middleware/upload");
const { uploadFile, getSignedUrl } = require("../controllers/fileController");

const router = express.Router({ mergeParams: true });

router.post("/upload", authenticate, requireProjectMember, uploadProjectFile, uploadFile);
router.post("/signed-url", authenticate, requireProjectMember, getSignedUrl);

module.exports = router;
