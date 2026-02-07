const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../src/app");
const User = require("../src/models/User");

let mongoServer;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.JWT_EXPIRES_IN = "15m";
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Auth flow", () => {
  it("registers and logs in a user", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "Test User", email: "test@example.com", password: "password123" })
      .expect(201);

    expect(registerRes.body.token).toBeTruthy();
    const user = await User.findOne({ email: "test@example.com" }).select("+password");
    expect(user).toBeTruthy();
    expect(user.password).not.toBe("password123");

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" })
      .expect(200);

    expect(loginRes.body.token).toBeTruthy();
  });

  it("allows access to protected projects with token", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" })
      .expect(200);

    const token = loginRes.body.token;

    await request(app)
      .get("/api/projects")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });
});
