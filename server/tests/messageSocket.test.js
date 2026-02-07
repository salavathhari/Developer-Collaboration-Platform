const http = require("http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { io: Client } = require("socket.io-client");

const app = require("../src/app");
const { initSocketServer } = require("../src/socket");
const User = require("../src/models/User");
const Project = require("../src/models/Project");
const Message = require("../src/models/Message");

let mongoServer;
let server;
let io;
let port;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  server = http.createServer(app);
  io = await initSocketServer(server);
  app.set("io", io);

  await new Promise((resolve) => {
    const listener = server.listen(0, () => {
      port = listener.address().port;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Socket message persistence", () => {
  it("saves message when sent via socket", async () => {
    const user = await User.create({
      name: "Socket User",
      email: "socket@example.com",
      password: "hashed",
    });

    const project = await Project.create({
      name: "Socket Project",
      owner: user.id,
      members: [{ user: user.id, role: "owner" }],
    });

    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET);

    const client = new Client(`http://localhost:${port}`, {
      auth: { token },
      transports: ["websocket"],
    });

    await new Promise((resolve) => client.on("connect", resolve));

    client.emit("join_room", { projectId: project.id });

    const received = new Promise((resolve) => {
      client.on("receive_message", (payload) => resolve(payload));
    });

    client.emit("send_message", {
      projectId: project.id,
      content: "Hello from socket",
      attachments: [],
    });

    await received;

    const saved = await Message.findOne({ projectId: project.id });
    expect(saved).toBeTruthy();
    expect(saved.content).toBe("Hello from socket");

    client.disconnect();
  });
});
