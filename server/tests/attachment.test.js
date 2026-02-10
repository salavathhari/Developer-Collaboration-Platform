const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const Attachment = require("../src/models/Attachment");
const Project = require("../src/models/Project");
const User = require("../src/models/User");
const jwt = require("jsonwebtoken");

describe("Attachment API", () => {
  let testUser;
  let testProject;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || "mongodb://localhost:27017/devcollab_test");

    // Create test user
    testUser = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "hashed_password",
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id, email: testUser.email },
      process.env.JWT_SECRET || "test_secret",
      { expiresIn: "1h" }
    );

    // Create test project
    testProject = await Project.create({
      name: "Test Project",
      description: "Test project for attachment tests",
      owner: testUser._id,
      members: [{ user: testUser._id, role: "owner" }],
    });
  });

  afterAll(async () => {
    // Cleanup
    await Attachment.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  afterEach(async () => {
    // Clear attachments after each test
    await Attachment.deleteMany({});
  });

  describe("POST /api/attachments/upload", () => {
    it("should upload a file successfully", async () => {
      const response = await request(app)
        .post("/api/attachments/upload")
        .set("Authorization", `Bearer ${authToken}`)
        .field("projectId", testProject._id.toString())
        .field("visibility", "project")
        .attach("file", Buffer.from("test file content"), "test.txt");

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("File uploaded successfully");
      expect(response.body.attachment).toHaveProperty("_id");
      expect(response.body.attachment.name).toBe("test.txt");
      expect(response.body.attachment.projectId).toBe(testProject._id.toString());
    });

    it("should reject upload without authentication", async () => {
      const response = await request(app)
        .post("/api/attachments/upload")
        .field("projectId", testProject._id.toString())
        .attach("file", Buffer.from("test content"), "test.txt");

      expect(response.status).toBe(401);
    });

    it("should reject upload without project ID", async () => {
      const response = await request(app)
        .post("/api/attachments/upload")
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from("test content"), "test.txt");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Project ID is required");
    });

    it("should reject upload with multiple contexts", async () => {
      const response = await request(app)
        .post("/api/attachments/upload")
        .set("Authorization", `Bearer ${authToken}`)
        .field("projectId", testProject._id.toString())
        .field("relatedTask", new mongoose.Types.ObjectId().toString())
        .field("relatedPR", new mongoose.Types.ObjectId().toString())
        .attach("file", Buffer.from("test content"), "test.txt");

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("only be linked to one context");
    });
  });

  describe("GET /api/attachments/project/:projectId", () => {
    let testAttachment;

    beforeEach(async () => {
      testAttachment = await Attachment.create({
        name: "test.txt",
        projectId: testProject._id,
        uploadedBy: testUser._id,
        url: "https://example.com/test.txt",
        storageKey: "test/key",
        size: 1024,
        mimeType: "text/plain",
        visibility: "project",
      });
    });

    it("should get all project files", async () => {
      const response = await request(app)
        .get(`/api/attachments/project/${testProject._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0].name).toBe("test.txt");
    });

    it("should filter files by context", async () => {
      const taskId = new mongoose.Types.ObjectId();
      
      await Attachment.create({
        name: "task-file.txt",
        projectId: testProject._id,
        uploadedBy: testUser._id,
        url: "https://example.com/task.txt",
        storageKey: "task/key",
        size: 512,
        mimeType: "text/plain",
        relatedTask: taskId,
        visibility: "project",
      });

      const response = await request(app)
        .get(`/api/attachments/project/${testProject._id}?context=task&contextId=${taskId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attachments).toHaveLength(1);
      expect(response.body.attachments[0].name).toBe("task-file.txt");
    });
  });

  describe("GET /api/attachments/:fileId", () => {
    let testAttachment;

    beforeEach(async () => {
      testAttachment = await Attachment.create({
        name: "test.txt",
        projectId: testProject._id,
        uploadedBy: testUser._id,
        url: "https://example.com/test.txt",
        storageKey: "test/key",
        size: 1024,
        mimeType: "text/plain",
        visibility: "project",
      });
    });

    it("should get single file with signed URL", async () => {
      const response = await request(app)
        .get(`/api/attachments/${testAttachment._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.attachment.name).toBe("test.txt");
      expect(response.body.attachment).toHaveProperty("signedUrl");
    });

    it("should reject access to private file by non-uploader", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other@example.com",
        password: "hashed_password",
      });

      await Project.findByIdAndUpdate(testProject._id, {
        $push: { members: { user: otherUser._id, role: "member" } },
      });

      testAttachment.visibility = "private";
      await testAttachment.save();

      const otherToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email },
        process.env.JWT_SECRET || "test_secret",
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .get(`/api/attachments/${testAttachment._id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/attachments/:fileId", () => {
    let testAttachment;

    beforeEach(async () => {
      testAttachment = await Attachment.create({
        name: "test.txt",
        projectId: testProject._id,
        uploadedBy: testUser._id,
        url: "https://example.com/test.txt",
        storageKey: "test/key",
        size: 1024,
        mimeType: "text/plain",
        visibility: "project",
      });
    });

    it("should delete file by uploader", async () => {
      const response = await request(app)
        .delete(`/api/attachments/${testAttachment._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("File deleted successfully");

      const deleted = await Attachment.findById(testAttachment._id);
      expect(deleted.isDeleted).toBe(true);
    });

    it("should reject deletion by non-uploader non-owner", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other2@example.com",
        password: "hashed_password",
      });

      await Project.findByIdAndUpdate(testProject._id, {
        $push: { members: { user: otherUser._id, role: "member" } },
      });

      const otherToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email },
        process.env.JWT_SECRET || "test_secret",
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .delete(`/api/attachments/${testAttachment._id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe("PUT /api/attachments/:fileId/link", () => {
    let testAttachment;

    beforeEach(async () => {
      testAttachment = await Attachment.create({
        name: "test.txt",
        projectId: testProject._id,
        uploadedBy: testUser._id,
        url: "https://example.com/test.txt",
        storageKey: "test/key",
        size: 1024,
        mimeType: "text/plain",
        visibility: "project",
      });
    });

    it("should link file to task", async () => {
      const taskId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/attachments/${testAttachment._id}/link`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ relatedTask: taskId.toString() });

      expect(response.status).toBe(200);
      expect(response.body.attachment.relatedTask).toBe(taskId.toString());
    });

    it("should reject linking to multiple contexts", async () => {
      const response = await request(app)
        .put(`/api/attachments/${testAttachment._id}/link`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          relatedTask: new mongoose.Types.ObjectId().toString(),
          relatedPR: new mongoose.Types.ObjectId().toString(),
        });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/attachments/:fileId/replace", () => {
    let testAttachment;

    beforeEach(async () => {
      testAttachment = await Attachment.create({
        name: "test.txt",
        projectId: testProject._id,
        uploadedBy: testUser._id,
        url: "https://example.com/test.txt",
        storageKey: "test/key",
        size: 1024,
        mimeType: "text/plain",
        visibility: "project",
        version: 1,
      });
    });

    it("should replace file by uploader", async () => {
      const response = await request(app)
        .post(`/api/attachments/${testAttachment._id}/replace`)
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", Buffer.from("new content"), "test-v2.txt");

      expect(response.status).toBe(200);
      expect(response.body.attachment.version).toBe(2);
      expect(response.body.attachment.meta.versions).toHaveLength(1);
    });

    it("should reject replacement by non-uploader", async () => {
      const otherUser = await User.create({
        name: "Other User",
        email: "other3@example.com",
        password: "hashed_password",
      });

      await Project.findByIdAndUpdate(testProject._id, {
        $push: { members: { user: otherUser._id, role: "member" } },
      });

      const otherToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email },
        process.env.JWT_SECRET || "test_secret",
        { expiresIn: "1h" }
      );

      const response = await request(app)
        .post(`/api/attachments/${testAttachment._id}/replace`)
        .set("Authorization", `Bearer ${otherToken}`)
        .attach("file", Buffer.from("new content"), "test-v2.txt");

      expect(response.status).toBe(403);
    });
  });
});
