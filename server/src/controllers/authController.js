const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  createRefreshToken,
  hashRefreshToken,
  isExpired,
} = require("../utils/refreshToken");

const signToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new ApiError(500, "JWT_SECRET is not set in the environment");
  }

  return jwt.sign({ sub: userId }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const refreshTtlMs = Number(
  process.env.JWT_REFRESH_EXPIRES_MS || 1000 * 60 * 60 * 24 * 14
);

const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: refreshTtlMs,
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken");
};

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: passwordHash,
  });

  const token = signToken(user.id);
  const refresh = createRefreshToken(refreshTtlMs);
  await RefreshToken.create({
    userId: user.id,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
  });
  setRefreshCookie(res, refresh.token);

  return res.status(201).json({
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
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

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const token = signToken(user.id);
  const refresh = createRefreshToken(refreshTtlMs);
  await RefreshToken.create({
    userId: user.id,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
  });
  setRefreshCookie(res, refresh.token);

  return res.status(200).json({
    token,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
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

const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;

  if (!token) {
    throw new ApiError(401, "Refresh token required");
  }

  const tokenHash = hashRefreshToken(token);
  const stored = await RefreshToken.findOne({ tokenHash, revokedAt: null });

  if (!stored || isExpired(stored.expiresAt)) {
    throw new ApiError(401, "Refresh token expired or invalid");
  }

  const accessToken = signToken(stored.userId);
  const refresh = createRefreshToken(refreshTtlMs);

  stored.revokedAt = new Date();
  stored.replacedBy = refresh.tokenHash;
  await stored.save();
  await RefreshToken.create({
    userId: stored.userId,
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
  });

  setRefreshCookie(res, refresh.token);

  return res.status(200).json({
    token: accessToken,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (token) {
    const tokenHash = hashRefreshToken(token);
    await RefreshToken.updateOne(
      { tokenHash },
      { revokedAt: new Date() }
    );
  }

  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
});

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
};
