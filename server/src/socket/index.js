const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const Message = require("../models/Message");
const Project = require("../models/Project");
const User = require("../models/User");
const { sanitizeString, sanitizeRichText } = require("../utils/sanitize");
const { createNotification, emitNotification } = require("../utils/notify");
const { logActivity } = require("../utils/activity");

// projectId -> Set(userId)
const presenceMap = new Map();
// userId -> { count, resetAt }
const rateLimitMap = new Map();

const getPresenceSet = (projectId) => {
  if (!presenceMap.has(projectId)) {
    presenceMap.set(projectId, new Set());
  }
  return presenceMap.get(projectId);
};

const canSend = (userId, limit, windowMs) => {
  const now = Date.now();
  const entry = rateLimitMap.get(userId) || { count: 0, resetAt: now + windowMs };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + windowMs;
  }

  entry.count += 1;
  rateLimitMap.set(userId, entry);

  return entry.count <= limit;
};

const setupRedisAdapter = async (io) => {
  if (!process.env.REDIS_URL) {
    return;
  }

  try {
    const { createClient } = require("redis");
    const { createAdapter } = require("@socket.io/redis-adapter");
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.io Redis adapter enabled");
  } catch (error) {
    console.warn("Redis adapter not enabled:", error.message);
  }
};

const initSocketServer = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
  });

  await setupRedisAdapter(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.sub;
      return next();
    } catch (error) {
      console.log("Socket auth failed:", error.message);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    socket.on("join_room", async ({ projectId }) => {
      if (!projectId) {
        return;
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return;
      }

      const isMember =
        project.owner.toString() === userId ||
        project.members.some((member) => member.user.toString() === userId);

      if (!isMember) {
        return;
      }

      socket.join(projectId);
      const presenceSet = getPresenceSet(projectId);
      presenceSet.add(userId);
      io.to(projectId).emit("presence_update", {
        projectId,
        onlineUserIds: Array.from(presenceSet),
      });
    });

    socket.on("leave_room", ({ projectId }) => {
      if (!projectId) {
        return;
      }

      socket.leave(projectId);
      const presenceSet = getPresenceSet(projectId);
      presenceSet.delete(userId);
      io.to(projectId).emit("presence_update", {
        projectId,
        onlineUserIds: Array.from(presenceSet),
      });
    });

    const emitTyping = (projectId) => {
      if (projectId) {
        socket.to(projectId).emit("typing", { projectId, userId });
        socket.to(projectId).emit("typing_start", { projectId, userId });
      }
    };

    const emitStopTyping = (projectId) => {
      if (projectId) {
        socket.to(projectId).emit("stop_typing", { projectId, userId });
        socket.to(projectId).emit("typing_stop", { projectId, userId });
      }
    };

    socket.on("typing", ({ projectId }) => emitTyping(projectId));
    socket.on("typing_start", ({ projectId }) => emitTyping(projectId));
    socket.on("stop_typing", ({ projectId }) => emitStopTyping(projectId));
    socket.on("typing_stop", ({ projectId }) => emitStopTyping(projectId));

    socket.on("send_message", async ({ projectId, content, attachments }) => {
      if (!projectId) {
        return;
      }

      const rateLimit = Number(process.env.SOCKET_RATE_LIMIT || 30);
      const windowMs = Number(process.env.SOCKET_RATE_WINDOW_MS || 60000);
      if (!canSend(userId, rateLimit, windowMs)) {
        socket.emit("rate_limited", { message: "Too many messages" });
        return;
      }

      const cleanContent = sanitizeRichText(content || "");
      const mentionEmails = (cleanContent.match(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
      ) || []).map((value) => value.toLowerCase());
      const safeAttachments = Array.isArray(attachments) ? attachments : [];

      if (!cleanContent && safeAttachments.length === 0) {
        return;
      }

      const message = await Message.create({
        projectId,
        senderId: userId,
        content: cleanContent,
        attachments: safeAttachments,
        readBy: [userId],
      });

      io.to(projectId).emit("receive_message", message);

      await logActivity({
        projectId,
        actorId: userId,
        type: "messageSent",
        payload: { messageId: message.id },
      });

      const project = await Project.findById(projectId);
      if (project) {
        const memberIds = project.members.map((m) => m.user.toString());
        memberIds.push(project.owner.toString());

        const targets = [...new Set(memberIds)].filter((id) => id !== userId);
        for (const targetId of targets) {
          const notification = await createNotification({
            userId: targetId,
            type: "message",
            projectId,
            payload: { messageId: message.id },
          });
          emitNotification(io, notification);
        }

        if (mentionEmails.length) {
          const mentionedUsers = await User.find({
            email: { $in: mentionEmails },
          }).select("_id");

          for (const mentioned of mentionedUsers) {
            const mentionedId = mentioned._id.toString();
            if (mentionedId === userId || !targets.includes(mentionedId)) {
              continue;
            }

            const notification = await createNotification({
              userId: mentionedId,
              type: "mention",
              projectId,
              payload: { messageId: message.id },
            });
            emitNotification(io, notification);
          }
        }
      }
    });

    socket.on("message_reaction", async ({ messageId, emoji }) => {
      if (!messageId || !emoji) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      message.reactions.set(userId, emoji);
      await message.save();
      io.to(message.projectId.toString()).emit("message_reaction", {
        messageId,
        userId,
        emoji,
      });
    });

    socket.on("message_read", async ({ messageId }) => {
      if (!messageId) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      if (!message.readBy.map((id) => id.toString()).includes(userId)) {
        message.readBy.push(userId);
        await message.save();
      }

      io.to(message.projectId.toString()).emit("message_read", {
        messageId,
        userId,
      });
    });

    // --- WebRTC Signaling Events ---

    const updateVideoPresence = (projectId) => {
        const room = io.sockets.adapter.rooms.get(`video:${projectId}`);
        const count = room ? room.size : 0;
        io.to(projectId).emit("video_status_update", { projectId, count, active: count > 0 });
    };

    // User joins the "video room" for a project
    socket.on("join_video_room", async ({ projectId }) => {
      // Security check: Ensure user is member of project
      // reusing existing checks if possible, or new minimal check
      // For performance, we assume 'join_room' was called previously or context is known.
      // But let's be safe:
      const project = await Project.findById(projectId);
      if (!project) return;
      const isMember = project.owner.toString() === userId || project.members.some((m) => m.user.toString() === userId);
      if (!isMember) return;

      socket.join(`video:${projectId}`);
      // Notify others in video room that a new user joined
      socket.to(`video:${projectId}`).emit("user_joined_video", { userId });
      
      updateVideoPresence(projectId);

      // OPTIONAL: Notify the text chat that a video session is active
      io.to(projectId).emit("system_notification", {
         type: "video_start",
         content: `User ${userId} joined the video channel.`,
         userId
      });
    });

    // User leaves the video room
    socket.on("leave_video_room", ({ projectId }) => {
      socket.leave(`video:${projectId}`);
      socket.to(`video:${projectId}`).emit("user_left_video", { userId });
      updateVideoPresence(projectId);
    });

    // Host ends the video session
    socket.on("end_video_session", async ({ projectId }) => {
        if (!projectId) return;
        const project = await Project.findById(projectId);
        if (!project || project.owner.toString() !== userId) {
            return; // Not unauthorized
        }

        // Notify everyone to leave
        io.to(`video:${projectId}`).emit("video_session_ended");
        io.to(projectId).emit("system_notification", {
             type: "video_end",
             content: `The video session was ended by the host.`,
             userId
        });

        // Loop through all sockets in the video room and make them leave
        const room = io.sockets.adapter.rooms.get(`video:${projectId}`);
        if (room) {
             for (const socketId of room) {
                 const clientSocket = io.sockets.sockets.get(socketId);
                 if (clientSocket) {
                     clientSocket.leave(`video:${projectId}`);
                 }
             }
        }
        updateVideoPresence(projectId);
    });

    // Relay WebRTC signals (Offer, Answer, ICE Candidate) to a specific target
    socket.on("webrtc_signal", ({ targetId, signal }) => {
      // Verify target is valid? Simplified for MVP.
      io.to(`user:${targetId}`).emit("webrtc_signal", {
        senderId: userId,
        signal,
      });
    });

    socket.on("disconnecting", () => {
       for (const room of socket.rooms) {
           if (room.startsWith("video:")) {
               const projectId = room.split(":")[1];
               // We need to wait for the leave to happen or manually calc
               // On disconnecting, socket is still in room.
               // We can cheat: calculate count - 1
               const roomObj = io.sockets.adapter.rooms.get(room);
               const count = roomObj ? roomObj.size - 1 : 0;
               io.to(projectId).emit("video_status_update", { projectId, count, active: count > 0 });
               socket.to(room).emit("user_left_video", { userId });
           }
       }
    });


    // --- WebRTC Signaling Events ---

    const updateVideoPresence = (projectId) => {
        const room = io.sockets.adapter.rooms.get(`video:${projectId}`);
        const count = room ? room.size : 0;
        io.to(projectId).emit("video_status_update", { projectId, count, active: count > 0 });
    };

    // User joins the "video room" for a project
    socket.on("join_video_room", async ({ projectId, meetingId }) => {
      // Security check: Ensure user is member of project
      // reusing existing checks if possible, or new minimal check
      // For performance, we assume 'join_room' was already called
      // OR we just trust the socket.rooms check if they joined the project room?
      // Better be safe:
      /* const project = await Project.findById(projectId);
      if (!project) return; 
      // ... check membership ... */
      // Ideally, we rely on the main room join logic for auth or repeat it.
      // Assuming user is authenticated via middleware and joined main project room.
      
      socket.join(`video:${projectId}`);
      
      // Notify others in video room that a new user joined
      // We send the 'initiator' signal to whom?
      // In Mesh, the new user initiates connections to ALL existing users OR existing users initiate to new user.
      // Pattern: New user joins. Server tells existing users "User X joined".
      // Existing users (peers) initiate a connection to User X.
      socket.to(`video:${projectId}`).emit("user_joined_video", { userId: socket.userId });
      
      // Get list of all OTHER users in the room to tell the new user who is there
      const room = io.sockets.adapter.rooms.get(`video:${projectId}`);
      const otherUsers = [];
      if (room) {
          for (const socketId of room) {
              const clientSocket = io.sockets.sockets.get(socketId);
              if (clientSocket && clientSocket.userId !== socket.userId) {
                  otherUsers.push(clientSocket.userId);
              }
          }
      }
      socket.emit("all_video_users", otherUsers);

      updateVideoPresence(projectId);
      
      // Update Meeting DB if tracking
      if (meetingId) {
         // Add participant logic here if using DB
      }
    });

    // User leaves the video room
    socket.on("leave_video_room", ({ projectId }) => {
      socket.leave(`video:${projectId}`);
      socket.to(`video:${projectId}`).emit("user_left_video", { userId: socket.userId });
      updateVideoPresence(projectId);
    });

    // Relay WebRTC signals (Offer, Answer, ICE Candidate) to a specific target
    socket.on("webrtc_signal", ({ targetId, signal }) => {
      io.to(`user:${targetId}`).emit("webrtc_signal", {
        senderId: socket.userId,
        signal,
      });
    });

    socket.on("disconnecting", () => {
       for (const room of socket.rooms) {
           if (room.startsWith("video:")) {
               const projectId = room.split(":")[1];
               // We need to wait for the leave to happen or manually calc
               const roomObj = io.sockets.adapter.rooms.get(room);
               const count = roomObj ? roomObj.size - 1 : 0;
               io.to(projectId).emit("video_status_update", { projectId, count: Math.max(0, count), active: count > 0 });
               socket.to(room).emit("user_left_video", { userId: socket.userId });
           }
       }
    });

    socket.on("disconnect", () => {
      presenceMap.forEach((set, projectId) => {
        if (set.delete(userId)) {
          io.to(projectId).emit("presence_update", {
            projectId,
            onlineUserIds: Array.from(set),
          });
        }
      });
    });
  });

  return io;
};

module.exports = {
  initSocketServer,
};
