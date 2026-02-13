const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const AuthToken = require("../models/AuthToken");
const { sendVerificationEmail, sendPasswordResetEmail, sendLoginNotificationEmail } = require("../utils/emailService");

// Token expiry constants
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES_SHORT = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_TOKEN_EXPIRES_LONG = 30 * 24 * 60 * 60 * 1000; // 30 days
const VERIFY_TOKEN_EXPIRES = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRES = 60 * 60 * 1000; // 1 hour

/**
 * Generate access token (short-lived JWT)
 */
const generateAccessToken = (userId) => {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is not configured");
  }
  return jwt.sign({ sub: userId }, secret, { expiresIn: ACCESS_TOKEN_EXPIRES });
};

/**
 * Generate random token and hash it for storage
 */
const generateTokenHash = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Create a secure random token
 */
const createSecureToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Set refresh token as HTTP-only cookie
 */
const setRefreshTokenCookie = (res, token, rememberMe = false) => {
  const maxAge = rememberMe ? REFRESH_TOKEN_EXPIRES_LONG : REFRESH_TOKEN_EXPIRES_SHORT;

  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
};

/**
 * Clear refresh token cookie
 */
const clearRefreshTokenCookie = (res) => {
  res.clearCookie("refreshToken", { path: "/" });
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character" };
  }
  return { valid: true };
};

/**
 * POST /api/auth/register
 * Register a new user and send verification email
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Check for duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: passwordHash,
      isVerified: false,
    });

    // Generate verification token
    const verificationToken = createSecureToken();
    const tokenHash = generateTokenHash(verificationToken);

    // Save verification token 
    await AuthToken.create({
      userId: user._id,
      tokenHash,
      type: "verify",
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_EXPIRES),
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Continue anyway - user can request resend
    }

    res.status(201).json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

/**
 * GET /api/auth/verify?token=...
 * Verify user's email address
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: "Verification token is required" });
    }

    const tokenHash = generateTokenHash(token);

    // Find valid token
    const authToken = await AuthToken.findOne({
      tokenHash,
      type: "verify",
      revokedAt: null,
    });

    if (!authToken) {
      return res.status(400).json({ error: "Invalid or expired verification token" });
    }

    // Check expiry
    if (authToken.expiresAt < new Date()) {
      return res.status(400).json({ error: "Verification token has expired" });
    }

    // Update user
    const user = await User.findById(authToken.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.isVerified) {
      return res.redirect(`${process.env.CLIENT_ORIGIN}/login?already_verified=1`);
    }

    user.isVerified = true;
    await user.save();

    // Revoke token
    authToken.revokedAt = new Date();
    await authToken.save();

    // Redirect to login with success message
    res.redirect(`${process.env.CLIENT_ORIGIN}/login?verified=1`);
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Email verification failed" });
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and issue tokens
 */
const login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if email is verified (DISABLED FOR DEVELOPMENT)
    // UNCOMMENT THE BELOW CODE WHEN DEPLOYING TO PRODUCTION
    /*
    if (!user.isVerified) {
      return res.status(403).json({
        error: "Email not verified",
        message: "Please verify your email before logging in. Check your inbox for the verification link.",
      });
    }
    */

    // Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = createSecureToken();
    const tokenHash = generateTokenHash(refreshToken);

    // Save refresh token
    const expiresAt = new Date(
      Date.now() + (rememberMe ? REFRESH_TOKEN_EXPIRES_LONG : REFRESH_TOKEN_EXPIRES_SHORT)
    );

    await AuthToken.create({
      userId: user._id,
      tokenHash,
      type: "refresh",
      expiresAt,
    });

    // Set refresh token cookie
    setRefreshTokenCookie(res, refreshToken, rememberMe);

    // Send login notification email (async, non-blocking)
    // Capture login details for security notification
    const loginDetails = {
      timestamp: new Date().toLocaleString('en-US', { 
        timeZone: 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      }),
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown Browser',
    };

    console.log(`\x1b[36m[Auth] Login successful for: ${user.email}\x1b[0m`);
    console.log(`   IP: ${loginDetails.ipAddress}`);
    console.log(`   Device: ${loginDetails.userAgent.substring(0, 50)}...`);

    // Send email asynchronously - don't await or block the response
    sendLoginNotificationEmail(user.email, user.name, loginDetails)
      .catch(err => console.error('\x1b[31m[Auth] Login notification email failed:\x1b[0m', err.message));

    res.status(200).json({
      success: true,
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRES,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

/**
 * POST /api/auth/refresh
 * Issue new access token using refresh token
 */
const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token not found" });
    }

    const tokenHash = generateTokenHash(refreshToken);

    // Find valid refresh token
    const authToken = await AuthToken.findOne({
      tokenHash,
      type: "refresh",
      revokedAt: null,
    });

    if (!authToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Check expiry
    if (authToken.expiresAt < new Date()) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "Refresh token expired" });
    }

    // Generate new access token
    const accessToken = generateAccessToken(authToken.userId);

    // Optional: Rotate refresh token for added security
    // For simplicity, we're not rotating here, but you can implement rotation

    res.status(200).json({
      success: true,
      accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRES,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
};

/**
 * POST /api/auth/logout
 * Revoke refresh token and clear cookie
 */
const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const tokenHash = generateTokenHash(refreshToken);

      // Revoke the token
      await AuthToken.updateOne(
        { tokenHash, type: "refresh" },
        { revokedAt: new Date() }
      );
    }

    clearRefreshTokenCookie(res);

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

/**
 * POST /api/auth/request-password-reset
 * Send password reset email
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    console.log(`\x1b[36m[Auth] Password reset requested for: ${email}\x1b[0m`);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: "If an account exists with that email, a password reset link has been sent.",
    };

    if (!user) {
      console.log(`\x1b[33m[Auth] Password reset - User not found: ${email}\x1b[0m`);
      return res.status(200).json(successResponse);
    }

    console.log(`\x1b[32m[Auth] User found: ${user.name} (${user._id})\x1b[0m`);

    // Generate reset token
    const resetToken = createSecureToken();
    const tokenHash = generateTokenHash(resetToken);

    // Revoke any existing reset tokens for this user
    await AuthToken.updateMany(
      { userId: user._id, type: "reset", revokedAt: null },
      { revokedAt: new Date() }
    );

    // Save reset token
    await AuthToken.create({
      userId: user._id,
      tokenHash,
      type: "reset",
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRES),
    });

    console.log(`\x1b[32m[Auth] Reset token created, expires in 1 hour\x1b[0m`);

    // Send reset email
    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      console.log(`\x1b[32m[Auth] Password reset email sent successfully\x1b[0m`);
    } catch (emailError) {
      console.error(`\x1b[31m[Auth] Failed to send password reset email:\x1b[0m`, emailError.message);
      // Continue anyway - we don't want to reveal email sending failure
    }

    res.status(200).json(successResponse);
  } catch (error) {
    console.error("\x1b[31m[Auth] Request password reset error:\x1b[0m", error);
    res.status(500).json({ error: "Password reset request failed" });
  }
};

/**
 * POST /api/auth/reset-password
 * Reset password using reset token
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    console.log(`\x1b[36m[Auth] Password reset attempt with token\x1b[0m`);

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    // Validate new password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      console.log(`\x1b[33m[Auth] Password validation failed: ${passwordValidation.message}\x1b[0m`);
      return res.status(400).json({ error: passwordValidation.message });
    }

    const tokenHash = generateTokenHash(token);

    // Find valid reset token
    const authToken = await AuthToken.findOne({
      tokenHash,
      type: "reset",
      revokedAt: null,
    });

    if (!authToken) {
      console.log(`\x1b[33m[Auth] Invalid or revoked reset token\x1b[0m`);
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Check expiry
    if (authToken.expiresAt < new Date()) {
      console.log(`\x1b[33m[Auth] Reset token expired\x1b[0m`);
      return res.status(400).json({ error: "Reset token has expired" });
    }

    // Find user
    const user = await User.findById(authToken.userId);
    if (!user) {
      console.log(`\x1b[31m[Auth] User not found for token\x1b[0m`);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`\x1b[32m[Auth] Valid token found for user: ${user.name} (${user.email})\x1b[0m`);

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.password = passwordHash;
    await user.save();

    console.log(`\x1b[32m[Auth] Password updated successfully\x1b[0m`);

    // Revoke reset token
    authToken.revokedAt = new Date();
    await authToken.save();

    // Revoke all refresh tokens for security
    await AuthToken.updateMany(
      { userId: user._id, type: "refresh", revokedAt: null },
      { revokedAt: new Date() }
    );

    console.log(`\x1b[32m[Auth] All refresh tokens revoked for user security\x1b[0m`);

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("\x1b[31m[Auth] Reset password error:\x1b[0m", error);
    res.status(500).json({ error: "Password reset failed" });
  }
};

/**
 * POST /api/auth/resend-verification
 * Resend verification email
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists
      return res.status(200).json({
        success: true,
        message: "If an unverified account exists, a verification email has been sent.",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    // Revoke existing verification tokens
    await AuthToken.updateMany(
      { userId: user._id, type: "verify", revokedAt: null },
      { revokedAt: new Date() }
    );

    // Generate new verification token
    const verificationToken = createSecureToken();
    const tokenHash = generateTokenHash(verificationToken);

    await AuthToken.create({
      userId: user._id,
      tokenHash,
      type: "verify",
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_EXPIRES),
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
    }

    res.status(200).json({
      success: true,
      message: "Verification email has been sent.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Failed to resend verification email" });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  refreshAccessToken,
  logout,
  requestPasswordReset,
  resetPassword,
  resendVerification,
};
