const express = require("express");

const { authenticate } = require("../middleware/auth");
const { uploadAvatar } = require("../middleware/upload");
const { validateProfileUpdate } = require("../middleware/validators");
const {
  getProfile,
  updateProfile,
  updateAvatar,
} = require("../controllers/userController");

const router = express.Router();

router.get("/me", authenticate, getProfile);
router.put("/me", authenticate, validateProfileUpdate, updateProfile);
router.post("/me/avatar", authenticate, uploadAvatar, updateAvatar);

module.exports = router;
