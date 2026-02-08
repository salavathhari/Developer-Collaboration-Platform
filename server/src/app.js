const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const projectRoutes = require("./routes/projects");
const messageRoutes = require("./routes/messages");
const taskRoutes = require("./routes/tasks");
const notificationRoutes = require("./routes/notifications");
const fileRoutes = require("./routes/files");
const activityRoutes = require("./routes/activity");
const aiRoutes = require("./routes/ai");
const summaryRoutes = require("./routes/summaries");
const insightRoutes = require("./routes/insights");
const columnRoutes = require("./routes/columns");
const prRoutes = require("./routes/pullRequests");
const meetingRoutes = require("./routes/meetingRoutes");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const app = express();

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
		origin: process.env.CORS_ORIGIN || "http://localhost:5173",
		credentials: true,
	})
);
app.use(requestLogger);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use(`/${uploadDir}`, express.static(path.join(process.cwd(), uploadDir)));

app.use("/", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects/:projectId/messages", messageRoutes);
app.use("/api/projects/:projectId/tasks", taskRoutes);
app.use("/api/projects/:projectId/files", fileRoutes);
app.use("/api/projects/:projectId/activity", activityRoutes);
app.use("/api/projects/:projectId/summaries", summaryRoutes);
app.use("/api/projects/:projectId/insights", insightRoutes);
app.use("/api/columns", columnRoutes);
app.use("/api/pull-requests", prRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ai", aiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
