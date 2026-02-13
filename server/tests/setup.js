const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");

let mongoServer;

// Setup before all tests
beforeAll(async () => {
  // Start in-memory MongoDB with increased timeout
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: "7.0.14",
      downloadDir: "./mongodb-binaries",
      skipMD5: true,
    },
    instance: {
      storageEngine: "wiredTiger",
    },
  });
  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("✅ Test database connected");
});

// Cleanup after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log("✅ Test database disconnected");
});

// Global test utilities
global.createTestUser = async (User, overrides = {}) => {
  const bcrypt = require("bcrypt");
  const defaultUser = {
    name: "Test User",
    email: "test@example.com",
    password: await bcrypt.hash("Test@123", 12),
    isVerified: true,
    ...overrides,
  };
  return await User.create(defaultUser);
};

global.generateTestToken = (userId) => {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET || "test-secret", {
    expiresIn: "1h",
  });
};

global.createTestProject = async (Project, ownerId, overrides = {}) => {
  const defaultProject = {
    name: "Test Project",
    description: "Test description",
    owner: ownerId,
    members: [{ user: ownerId, role: "owner" }],
    ...overrides,
  };
  return await Project.create(defaultProject);
};

// Silence console during tests (optional)
if (process.env.SILENCE_TESTS === "true") {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
