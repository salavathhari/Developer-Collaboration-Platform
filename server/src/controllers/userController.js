const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const getProfile = asyncHandler(async (req, res) => {
  return res.status(200).json({ user: req.user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, email, bio } = req.body;
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (email && email !== user.email) {
    const existing = await User.findOne({ email });
    if (existing) {
      throw new ApiError(409, "Email already in use");
    }
    user.email = email;
  }

  if (name !== undefined) {
    user.name = name;
  }

  if (bio !== undefined) {
    user.bio = bio;
  }

  await user.save();

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
    },
  });
});

const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Avatar file is required");
  }

  const uploadDir = process.env.UPLOAD_DIR || "uploads";
  const avatarPath = `/${uploadDir}/avatars/${req.file.filename}`;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { avatar: avatarPath },
    { new: true }
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
    },
  });
});

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
};
