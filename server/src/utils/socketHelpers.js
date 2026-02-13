/**
 * Socket.io Enhancement Utilities
 * Provides error handling, reconnection logic, and connection stability
 */

/**
 * Wrap socket event handlers with error handling
 */
const wrapSocketHandler = (handler) => {
  return async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      console.error("[Socket] Event handler error:", error);
      
      // Extract socket reference from args if available
      const socket = args.find(arg => arg && typeof arg.emit === 'function');
      if (socket) {
        socket.emit("error", {
          message: "An error occurred processing your request",
          code: "SOCKET_HANDLER_ERROR",
        });
      }
    }
  };
};

/**
 * Validate socket event payload
 */
const validateSocketPayload = (payload, requiredFields = []) => {
  if (!payload || typeof payload !== "object") {
    return { valid: false, message: "Invalid payload" };
  }

  for (const field of requiredFields) {
    if (!(field in payload) || payload[field] === null || payload[field] === undefined) {
      return { valid: false, message: `Missing required field: ${field}` };
    }
  }

  return { valid: true };
};

/**
 * Create a rate limiter for socket events
 */
class SocketRateLimiter {
  constructor(maxRequests = 30, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.userLimits = new Map();
  }

  checkLimit(userId) {
    const now = Date.now();
    const userLimit = this.userLimits.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
      this.userLimits.set(userId, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    userLimit.count += 1;
    this.userLimits.set(userId, userLimit);

    if (userLimit.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((userLimit.resetAt - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - userLimit.count,
    };
  }

  reset(userId) {
    this.userLimits.delete(userId);
  }

  cleanup() {
    const now = Date.now();
    for (const [userId, limit] of this.userLimits.entries()) {
      if (now > limit.resetAt) {
        this.userLimits.delete(userId);
      }
    }
  }
}

/**
 * Handle socket disconnection with cleanup
 */
const handleDisconnection = (socket, userId, presenceMap, io) => {
  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (User: ${userId}) - Reason: ${reason}`);

    // Clean up presence from all rooms
    for (const [projectId, userSet] of presenceMap.entries()) {
      if (userSet.has(userId)) {
        userSet.delete(userId);
        io.to(projectId).emit("presence_update", {
          projectId,
          onlineUserIds: Array.from(userSet),
        });
      }
    }

    // Handle reconnection attempts
    if (reason === "transport error" || reason === "ping timeout") {
      console.log(`Connection lost for user ${userId}, client may attempt to reconnect`);
    }
  });

  socket.on("error", (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
};

/**
 * Heartbeat mechanism to detect stale connections
 */
class ConnectionMonitor {
  constructor(io, interval = 30000) {
    this.io = io;
    this.interval = interval;
    this.timer = null;
    this.connections = new Map();
  }

  start() {
    this.timer = setInterval(() => {
      const now = Date.now();
      
      // Check all sockets
      const sockets = Array.from(this.io.sockets.sockets.values());
      
      for (const socket of sockets) {
        const lastSeen = this.connections.get(socket.id);
        
        if (!lastSeen) {
          this.connections.set(socket.id, now);
          continue;
        }

        // If no activity for 2x interval, consider stale
        if (now - lastSeen > this.interval * 2) {
          console.warn(`Stale connection detected: ${socket.id}`);
          socket.emit("ping_check");
        }
      }

      // Clean up disconnected sockets
      for (const [socketId] of this.connections.entries()) {
        if (!this.io.sockets.sockets.has(socketId)) {
          this.connections.delete(socketId);
        }
      }
    }, this.interval);

    console.log(`Connection monitor started (interval: ${this.interval}ms)`);
  }

  recordActivity(socketId) {
    this.connections.set(socketId, Date.now());
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Emit with acknowledgment and timeout
 */
const emitWithAck = (socket, event, data, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Acknowledgment timeout for event: ${event}`));
    }, timeout);

    socket.emit(event, data, (response) => {
      clearTimeout(timer);
      resolve(response);
    });
  });
};

/**
 * Broadcast to room with delivery confirmation tracking
 */
const broadcastToRoom = (io, room, event, data, options = {}) => {
  const { excludeSockets = [], trackDelivery = false } = options;

  io.to(room).except(excludeSockets).emit(event, data);

  if (trackDelivery) {
    const sockets = Array.from(io.sockets.adapter.rooms.get(room) || []);
    return {
      sent: sockets.length - excludeSockets.length,
      socketIds: sockets.filter((id) => !excludeSockets.includes(id)),
    };
  }

  return { sent: -1 };
};

/**
 * Safely join a room with validation
 */
const safeJoinRoom = async (socket, room, validator = null) => {
  if (validator && typeof validator === "function") {
    const isValid = await validator(socket, room);
    if (!isValid) {
      socket.emit("error", {
        message: "Cannot join room: Access denied",
        code: "ROOM_ACCESS_DENIED",
      });
      return false;
    }
  }

  socket.join(room);
  console.log(`Socket ${socket.id} joined room: ${room}`);
  return true;
};

module.exports = {
  wrapSocketHandler,
  validateSocketPayload,
  SocketRateLimiter,
  handleDisconnection,
  ConnectionMonitor,
  emitWithAck,
  broadcastToRoom,
  safeJoinRoom,
};
