const http = require("http");
const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");
const { initSocketServer } = require("./socket");
const notificationService = require("./services/notificationService");
const redisService = require("./services/redisService");
const logger = require("./utils/logger");

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDb();
    logger.info("Database connected successfully");
    
    // Connect to Redis (non-blocking - app works without Redis)
    const redisConnected = await redisService.connect();
    if (redisConnected) {
      logger.info("Redis connected successfully");
      // Make Redis available globally for health checks
      global.redisClient = redisService.client;
    } else {
      logger.warn("Redis not available - caching disabled");
    }
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize WebSocket server
    const io = await initSocketServer(server);
    logger.info("WebSocket server initialized");
    
    // Inject Socket.io into notification service
    notificationService.setIO(io);
    logger.info("Notification service initialized");
    
    // Make Socket.io available to routes
    app.set("io", io);
    global.io = io;

    // Start listening
    server.listen(port, () => {
      logger.info(`Server running on port ${port} in ${process.env.NODE_ENV} mode`);
      logger.info("🚀 Application started successfully");
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info("HTTP server closed");
        
        try {
          // Close Socket.io
          io.close(() => {
            logger.info("WebSocket server closed");
          });
          
          // Disconnect Redis
          await redisService.disconnect();
          logger.info("Redis disconnected");
          
          // Close MongoDB
          const mongoose = require("mongoose");
          await mongoose.connection.close();
          logger.info("MongoDB disconnected");
          
          logger.info("Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          logger.error({ err: error }, "Error during shutdown");
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.error({ err: error }, "Uncaught exception");
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error({ reason, promise }, "Unhandled promise rejection");
    });

  } catch (error) {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
};

startServer();
