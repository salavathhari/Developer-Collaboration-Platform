const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  register,
  verifyEmail,
  login,
  refreshAccessToken,
  logout,
  requestPasswordReset,
  resetPassword,
  resendVerification,
} = require("../controllers/authController");

const router = express.Router();

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX) || 20, // 20 requests per window
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes
router.post("/register", authLimiter, register);
router.get("/verify", verifyEmail); // Email link - no rate limiting
router.post("/login", authLimiter, login);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logout);
router.post("/request-password-reset", authLimiter, requestPasswordReset);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/resend-verification", authLimiter, resendVerification);

module.exports = router;
