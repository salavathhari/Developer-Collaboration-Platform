const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Middleware to verify JWT access token from Authorization header
 * Sets req.user with user data if valid
 */
const verifyAccessToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader ||!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

    if (!accessSecret) {
      console.error("JWT_ACCESS_SECRET is not set in environment");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const decoded = jwt.verify(token, accessSecret);

    // Fetch user from database (exclude password)
    const user = await User.findById(decoded.sub || decoded.userId || decoded.id);

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Attach user to request object
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    console.error("Auth middleware error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

/**
 * Middleware to check if user's email is verified
 * Must be used after verifyAccessToken
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      error: "Email verification required",
      message: "Please verify your email before accessing this resource",
    });
  }

  next();
};

module.exports = {
  verifyAccessToken,
  requireVerified,
};
