const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../src/app");
const gitService = require("../src/services/gitService");
const Project = require("../src/models/Project");
const PullRequest = require("../src/models/PullRequest");
const Task = require("../src/models/Task");
const User = require("../src/models/User");

describe("PR merge updates linked task", () => {
  let mongoServer;
  let token;
  let user;
  let project;
  let pr;
  let task;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    app.set("io", {
      to: () => ({ emit: () => {} }),
    });

    user = await User.create({
      name: "PR Owner",
      email: "owner@example.com",
      password: "Password123!",
    });

    token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET);

    project = await Project.create({
      name: "PR Project",
      owner: user._id,
      members: [{ user: user._id, role: "owner" }],
    });

    pr = await PullRequest.create({
      number: 1,
      title: "Feature PR",
      description: "Test PR",
      projectId: project._id,
      author: user._id,
      status: "open",
      baseBranch: "main",
      headBranch: "feature/test",
      approvals: [{ userId: user._id, approvedAt: new Date() }],
      filesChanged: [],
    });

    task = await Task.create({
      projectId: project._id,
      title: "Linked task",
      status: "in_progress",
      priority: "medium",
      createdBy: user._id,
      linkedPRId: pr._id,
      orderKey: 1000,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  it("sets linked task status to done after merge", async () => {
    jest.spyOn(gitService, "merge").mockResolvedValue({
      success: true,
      mergeCommitHash: "abc123",
      output: "",
    });

    const response = await request(app)
      .post(`/api/pull-requests/${pr._id}/merge`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updatedTask = await Task.findById(task._id);
    expect(updatedTask.status).toBe("done");

    gitService.merge.mockRestore();
  });
});
