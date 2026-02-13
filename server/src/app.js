const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const logger = require("./utils/logger");
const { 
  initSentry, 
  sentryRequestHandler, 
  sentryTracingHandler, 
  sentryErrorHandler 
} = require("./utils/sentry");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const projectRoutes = require("./routes/projects");
const messageRoutes = require("./routes/messages");
const taskRoutes = require("./routes/tasks");
const taskQueryRoutes = require("./routes/tasksQuery");
const notificationRoutes = require("./routes/notifications");
const fileRoutes = require("./routes/files");
const activityRoutes = require("./routes/activity");
const aiRoutes = require("./routes/ai");
const summaryRoutes = require("./routes/summaries");
const insightRoutes = require("./routes/insights");
const columnRoutes = require("./routes/columns");
const prRoutes = require("./routes/pullRequests");
const meetingRoutes = require("./routes/meetingRoutes");
const repoRoutes = require("./routes/repos");
const codeRoutes = require("./routes/code");
const chatRoutes = require("./routes/chat");
const commentRoutes = require("./routes/comments");
const issueRoutes = require("./routes/issues");
const attachmentRoutes = require("./routes/attachmentRoutes");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

// Initialize Sentry (must be first)
initSentry(app);

// Sentry request handler (must be first middleware)
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Security middleware
app.use(helmet());
app.use(
	rateLimit({
		windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
		max: Number(process.env.RATE_LIMIT_MAX || 120),
		standardHeaders: true,
		legacyHeaders: false,
	})
);

app.use(
	cors({
		origin: [
			"http://localhost:5173",
			"http://localhost:5174",
			"http://localhost:5175",
			process.env.CORS_ORIGIN,
		].filter(Boolean),
		credentials: true,
	})
);
app.use(requestLogger);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use(`/${uploadDir}`, express.static(path.join(process.cwd(), uploadDir)));

app.use("/", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects/:projectId/messages", messageRoutes);
app.use("/api/projects/:projectId/tasks", taskRoutes);
app.use("/api/tasks", taskQueryRoutes);
app.use("/api/projects/:projectId/files", fileRoutes);
app.use("/api/projects/:projectId/activity", activityRoutes);
app.use("/api/projects/:projectId/summaries", summaryRoutes);
app.use("/api/projects/:projectId/insights", insightRoutes);
app.use("/api/columns", columnRoutes);
app.use("/api/pull-requests", prRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);
// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler());

// Application error handlers
app.use("/api/repos", repoRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/attachments", attachmentRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
