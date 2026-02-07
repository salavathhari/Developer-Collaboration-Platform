const http = require("http");
const dotenv = require("dotenv");

const app = require("./app");
const connectDb = require("./config/db");
const { initSocketServer } = require("./socket");

dotenv.config();

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDb();
    const server = http.createServer(app);
    const io = await initSocketServer(server);
    app.set("io", io);

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
