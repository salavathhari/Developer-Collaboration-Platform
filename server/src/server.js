const dotenv = require("dotenv");

const app = require("./app");
const connectDb = require("./config/db");

dotenv.config();

const port = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDb();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
