const http = require("http");
const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");
const { initSocketServer } = require("./socket");
const notificationService = require("./services/notificationService");

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDb();
    const server = http.createServer(app);
    const io = await initSocketServer(server);
    
    // Inject Socket.io into notification service for real-time notifications
    notificationService.setIO(io);
    
    app.set("io", io);

    server.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
      console.log(`✅ WebSocket server initialized`);
      console.log(`✅ Notification service ready`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
