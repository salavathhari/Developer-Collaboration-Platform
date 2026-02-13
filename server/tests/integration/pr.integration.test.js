const request = require("supertest");
const app = require("../../src/app");
const PullRequest = require("../../src/models/PullRequest");
const Project = require("../../src/models/Project");
const User = require("../../src/models/User");
const Task = require("../../src/models/Task");

describe("Pull Request Workflow Integration Tests", () => {
  let authToken;
  let testUser;
  let testProject;
  let reviewer;

  beforeEach(async () => {
    testUser = await global.createTestUser(User);
    reviewer = await global.createTestUser(User, { email: "reviewer@test.com" });
    authToken = global.generateTestToken(testUser);
    testProject = await global.createTestProject(Project, testUser._id);

    // Add reviewer as project member
    testProject.members.push({ user: reviewer._id, role: "developer" });
    await testProject.save();
  });

  describe("POST /api/pull-requests", () => {
    it("should create a new pull request", async () => {
      const prData = {
        title: "Add authentication feature",
        description: "Implements JWT-based authentication",
        sourceBranch: "feature/auth",
        targetBranch: "main",
        projectId: testProject._id,
        reviewers: [reviewer._id],
      };

      const response = await request(app)
        .post("/api/pull-requests")
        .set("Authorization", `Bearer ${authToken}`)
        .send(prData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.pullRequest.title).toBe(prData.title);
      expect(response.body.pullRequest.status).toBe("open");
      expect(response.body.pullRequest.reviewers).toHaveLength(1);
      expect(response.body.pullRequest.author.toString()).toBe(testUser._id.toString());

      // Verify in database
      const dbPR = await PullRequest.findById(response.body.pullRequest._id);
      expect(dbPR).toBeTruthy();
      expect(dbPR.number).toBeGreaterThan(0);
    });

    it("should auto-increment PR number", async () => {
      const pr1 = await request(app)
        .post("/api/pull-requests")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "PR 1",
          sourceBranch: "feature-1",
          targetBranch: "main",
          projectId: testProject._id,
        })
        .expect(201);

      const pr2 = await request(app)
        .post("/api/pull-requests")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "PR 2",
          sourceBranch: "feature-2",
          targetBranch: "main",
          projectId: testProject._id,
        })
        .expect(201);

      expect(pr2.body.pullRequest.number).toBe(pr1.body.pullRequest.number + 1);
    });

    it("should reject PR without title", async () => {
      await request(app)
        .post("/api/pull-requests")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          sourceBranch: "feature",
          targetBranch: "main",
          projectId: testProject._id,
        })
        .expect(400);
    });

    it("should reject PR with same source and target branch", async () => {
      const response = await request(app)
        .post("/api/pull-requests")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Invalid PR",
          sourceBranch: "main",
          targetBranch: "main",
          projectId: testProject._id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/pull-requests/:id/review", () => {
    let testPR;

    beforeEach(async () => {
      testPR = await PullRequest.create({
        title: "Test PR for review",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        reviewers: [reviewer._id],
        number: 1,
      });
    });

    it("should approve pull request", async () => {
      const reviewerToken = global.generateTestToken(reviewer);

      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/review`)
        .set("Authorization", `Bearer ${reviewerToken}`)
        .send({
          status: "approved",
          comment: "Looks good!",
        })
        .expect(200);

      expect(response.body.pullRequest.reviews).toHaveLength(1);
      expect(response.body.pullRequest.reviews[0].status).toBe("approved");
      expect(response.body.pullRequest.reviews[0].reviewer.toString()).toBe(
        reviewer._id.toString()
      );
    });

    it("should request changes on pull request", async () => {
      const reviewerToken = global.generateTestToken(reviewer);

      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/review`)
        .set("Authorization", `Bearer ${reviewerToken}`)
        .send({
          status: "changes_requested",
          comment: "Please fix the tests",
        })
        .expect(200);

      expect(response.body.pullRequest.reviews[0].status).toBe("changes_requested");
      expect(response.body.pullRequest.reviews[0].comment).toBe("Please fix the tests");
    });

    it("should not allow author to review their own PR", async () => {
      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/review`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          status: "approved",
          comment: "Self approval",
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it("should not allow reviewing closed PR", async () => {
      testPR.status = "closed";
      await testPR.save();

      const reviewerToken = global.generateTestToken(reviewer);

      await request(app)
        .post(`/api/pull-requests/${testPR._id}/review`)
        .set("Authorization", `Bearer ${reviewerToken}`)
        .send({
          status: "approved",
        })
        .expect(400);
    });
  });

  describe("POST /api/pull-requests/:id/merge", () => {
    let testPR;

    beforeEach(async () => {
      testPR = await PullRequest.create({
        title: "PR to merge",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        reviewers: [reviewer._id],
        number: 1,
        reviews: [
          {
            reviewer: reviewer._id,
            status: "approved",
            comment: "LGTM",
            reviewedAt: new Date(),
          },
        ],
      });
    });

    it("should merge approved pull request", async () => {
      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/merge`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ mergeMessage: "Merging feature" })
        .expect(200);

      expect(response.body.pullRequest.status).toBe("merged");
      expect(response.body.pullRequest.mergedAt).toBeTruthy();
      expect(response.body.pullRequest.mergedBy.toString()).toBe(testUser._id.toString());
    });

    it("should not merge unapproved PR", async () => {
      const unapprovedPR = await PullRequest.create({
        title: "Unapproved PR",
        sourceBranch: "feature-2",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        number: 2,
        reviews: [],
      });

      const response = await request(app)
        .post(`/api/pull-requests/${unapprovedPR._id}/merge`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("approved");
    });

    it("should not merge PR with changes requested", async () => {
      testPR.reviews.push({
        reviewer: testUser._id,
        status: "changes_requested",
        comment: "Needs work",
        reviewedAt: new Date(),
      });
      await testPR.save();

      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/merge`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should handle merge conflicts", async () => {
      testPR.hasConflicts = true;
      await testPR.save();

      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/merge`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("conflict");
    });
  });

  describe("PR and Task linking", () => {
    let testTask;
    let testPR;

    beforeEach(async () => {
      const Column = require("../../src/models/Column");
      const column = await Column.create({
        name: "To Do",
        projectId: testProject._id,
        order: 0,
      });

      testTask = await Task.create({
        title: "Task to link",
        projectId: testProject._id,
        columnId: column._id,
        createdBy: testUser._id,
        status: "in_progress",
      });

      testPR = await PullRequest.create({
        title: "PR for task",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        linkedTasks: [testTask._id],
        number: 1,
      });
    });

    it("should auto-complete linked tasks on PR merge", async () => {
      // Approve PR
      testPR.reviews.push({
        reviewer: reviewer._id,
        status: "approved",
        reviewedAt: new Date(),
      });
      await testPR.save();

      // Merge PR
      await request(app)
        .post(`/api/pull-requests/${testPR._id}/merge`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Check task status
      const updatedTask = await Task.findById(testTask._id);
      expect(updatedTask.status).toBe("done");
    });

    it("should link PR to task", async () => {
      const response = await request(app)
        .put(`/api/pull-requests/${testPR._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ linkedTasks: [testTask._id] })
        .expect(200);

      expect(response.body.pullRequest.linkedTasks).toContain(testTask._id.toString());
    });
  });

  describe("GET /api/pull-requests", () => {
    beforeEach(async () => {
      await PullRequest.create([
        {
          title: "Open PR",
          sourceBranch: "f1",
          targetBranch: "main",
          projectId: testProject._id,
          author: testUser._id,
          status: "open",
          number: 1,
        },
        {
          title: "Merged PR",
          sourceBranch: "f2",
          targetBranch: "main",
          projectId: testProject._id,
          author: testUser._id,
          status: "merged",
          mergedAt: new Date(),
          number: 2,
        },
        {
          title: "Closed PR",
          sourceBranch: "f3",
          targetBranch: "main",
          projectId: testProject._id,
          author: reviewer._id,
          status: "closed",
          number: 3,
        },
      ]);
    });

    it("should get all PRs for a project", async () => {
      const response = await request(app)
        .get(`/api/pull-requests?projectId=${testProject._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pullRequests).toHaveLength(3);
    });

    it("should filter PRs by status", async () => {
      const response = await request(app)
        .get(`/api/pull-requests?projectId=${testProject._id}&status=open`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pullRequests).toHaveLength(1);
      expect(response.body.pullRequests[0].status).toBe("open");
    });

    it("should filter PRs by author", async () => {
      const response = await request(app)
        .get(`/api/pull-requests?projectId=${testProject._id}&author=${reviewer._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pullRequests).toHaveLength(1);
      expect(response.body.pullRequests[0].author.toString()).toBe(reviewer._id.toString());
    });
  });

  describe("POST /api/pull-requests/:id/comments", () => {
    let testPR;

    beforeEach(async () => {
      testPR = await PullRequest.create({
        title: "PR with comments",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        number: 1,
      });
    });

    it("should add comment to PR", async () => {
      const response = await request(app)
        .post(`/api/pull-requests/${testPR._id}/comments`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          text: "This is a PR comment",
          lineNumber: 42,
          filePath: "src/auth.js",
        })
        .expect(201);

      expect(response.body.comment.text).toBe("This is a PR comment");
      expect(response.body.comment.lineNumber).toBe(42);

      // Verify in database
      const dbPR = await PullRequest.findById(testPR._id);
      expect(dbPR.comments).toHaveLength(1);
    });
  });

  describe("PUT /api/pull-requests/:id/close", () => {
    let testPR;

    beforeEach(async () => {
      testPR = await PullRequest.create({
        title: "PR to close",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        number: 1,
      });
    });

    it("should close pull request without merging", async () => {
      const response = await request(app)
        .put(`/api/pull-requests/${testPR._id}/close`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ reason: "No longer needed" })
        .expect(200);

      expect(response.body.pullRequest.status).toBe("closed");
      expect(response.body.pullRequest.closedAt).toBeTruthy();

      // Verify not merged
      const dbPR = await PullRequest.findById(testPR._id);
      expect(dbPR.mergedAt).toBeNull();
    });
  });
});
