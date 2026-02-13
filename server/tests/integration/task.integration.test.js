const request = require("supertest");
const app = require("../../src/app");
const Task = require("../../src/models/Task");
const Project = require("../../src/models/Project");
const User = require("../../src/models/User");
const Column = require("../../src/models/Column");

describe("Task Workflow Integration Tests", () => {
  let authToken;
  let testUser;
  let testProject;
  let testColumn;

  beforeEach(async () => {
    // Create user and project
    testUser = await global.createTestUser(User);
    authToken = global.generateTestToken(testUser);
    testProject = await global.createTestProject(Project, testUser._id);

    // Create column for tasks
    testColumn = await Column.create({
      name: "To Do",
      projectId: testProject._id,
      order: 0,
    });
  });

  describe("POST /api/tasks", () => {
    it("should create a new task with all fields", async () => {
      const taskData = {
        title: "Implement user authentication",
        description: "Add JWT-based authentication system",
        projectId: testProject._id,
        columnId: testColumn._id,
        assignees: [testUser._id],
        priority: "high",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        tags: ["backend", "security"],
        estimatedHours: 8,
      };

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${authToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.task.title).toBe(taskData.title);
      expect(response.body.task.priority).toBe("high");
      expect(response.body.task.assignees).toHaveLength(1);
      expect(response.body.task.tags).toEqual(["backend", "security"]);

      // Verify in database
      const dbTask = await Task.findById(response.body.task._id);
      expect(dbTask).toBeTruthy();
      expect(dbTask.createdBy.toString()).toBe(testUser._id.toString());
    });

    it("should create task with minimal required fields", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Simple task",
          projectId: testProject._id,
          columnId: testColumn._id,
        })
        .expect(201);

      expect(response.body.task.title).toBe("Simple task");
      expect(response.body.task.status).toBe("to_do");
      expect(response.body.task.priority).toBe("medium");
    });

    it("should reject task without title", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          projectId: testProject._id,
          columnId: testColumn._id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject task with invalid project ID", async () => {
      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Test task",
          projectId: "invalid-id",
          columnId: testColumn._id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it("should reject unauthorized user", async () => {
      await request(app)
        .post("/api/tasks")
        .send({
          title: "Test task",
          projectId: testProject._id,
          columnId: testColumn._id,
        })
        .expect(401);
    });
  });

  describe("PUT /api/tasks/:id", () => {
    let testTask;

    beforeEach(async () => {
      testTask = await Task.create({
        title: "Original task",
        projectId: testProject._id,
        columnId: testColumn._id,
        createdBy: testUser._id,
        status: "to_do",
      });
    });

    it("should update task title and description", async () => {
      const updates = {
        title: "Updated task title",
        description: "New description",
      };

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.task.title).toBe(updates.title);
      expect(response.body.task.description).toBe(updates.description);

      // Verify in database
      const dbTask = await Task.findById(testTask._id);
      expect(dbTask.title).toBe(updates.title);
    });

    it("should update task status and track in activity", async () => {
      const response = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ status: "in_progress" })
        .expect(200);

      expect(response.body.task.status).toBe("in_progress");

      // Check activity log
      const dbTask = await Task.findById(testTask._id);
      const statusActivity = dbTask.activity.find(
        (a) => a.type === "status_change"
      );
      expect(statusActivity).toBeTruthy();
      expect(statusActivity.oldValue).toBe("to_do");
      expect(statusActivity.newValue).toBe("in_progress");
    });

    it("should update task assignees", async () => {
      const newAssignee = await global.createTestUser(User, {
        email: "assignee@test.com",
      });

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ assignees: [newAssignee._id] })
        .expect(200);

      expect(response.body.task.assignees).toHaveLength(1);
      expect(response.body.task.assignees[0].toString()).toBe(
        newAssignee._id.toString()
      );
    });

    it("should not allow updating non-existent task", async () => {
      const fakeId = "507f1f77bcf86cd799439011";
      await request(app)
        .put(`/api/tasks/${fakeId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ title: "Updated" })
        .expect(404);
    });
  });

  describe("GET /api/tasks", () => {
    beforeEach(async () => {
      // Create multiple tasks
      await Task.create([
        {
          title: "Task 1",
          projectId: testProject._id,
          columnId: testColumn._id,
          createdBy: testUser._id,
          status: "to_do",
          priority: "high",
        },
        {
          title: "Task 2",
          projectId: testProject._id,
          columnId: testColumn._id,
          createdBy: testUser._id,
          status: "in_progress",
          priority: "medium",
        },
        {
          title: "Task 3",
          projectId: testProject._id,
          columnId: testColumn._id,
          createdBy: testUser._id,
          status: "done",
          priority: "low",
        },
      ]);
    });

    it("should get all tasks for a project", async () => {
      const response = await request(app)
        .get(`/api/tasks?projectId=${testProject._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tasks).toHaveLength(3);
      expect(response.body.tasks.every((t) => t.projectId === testProject._id.toString())).toBe(
        true
      );
    });

    it("should filter tasks by status", async () => {
      const response = await request(app)
        .get(`/api/tasks?projectId=${testProject._id}&status=in_progress`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].status).toBe("in_progress");
    });

    it("should filter tasks by priority", async () => {
      const response = await request(app)
        .get(`/api/tasks?projectId=${testProject._id}&priority=high`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].priority).toBe("high");
    });

    it("should filter tasks assigned to user", async () => {
      const assignee = await global.createTestUser(User, {
        email: "assignee@test.com",
      });

      await Task.create({
        title: "Assigned task",
        projectId: testProject._id,
        columnId: testColumn._id,
        createdBy: testUser._id,
        assignees: [assignee._id],
      });

      const response = await request(app)
        .get(`/api/tasks?projectId=${testProject._id}&assignee=${assignee._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tasks).toHaveLength(1);
      expect(response.body.tasks[0].title).toBe("Assigned task");
    });
  });

  describe("POST /api/tasks/:id/comments", () => {
    let testTask;

    beforeEach(async () => {
      testTask = await Task.create({
        title: "Task with comments",
        projectId: testProject._id,
        columnId: testColumn._id,
        createdBy: testUser._id,
      });
    });

    it("should add comment to task", async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ text: "This is a comment" })
        .expect(201);

      expect(response.body.comment.text).toBe("This is a comment");
      expect(response.body.comment.author.toString()).toBe(testUser._id.toString());

      // Verify in database
      const dbTask = await Task.findById(testTask._id);
      expect(dbTask.comments).toHaveLength(1);
      expect(dbTask.comments[0].text).toBe("This is a comment");
    });

    it("should reject empty comment", async () => {
      await request(app)
        .post(`/api/tasks/${testTask._id}/comments`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ text: "" })
        .expect(400);
    });
  });

  describe("Task and PR linking", () => {
    let testTask;

    beforeEach(async () => {
      testTask = await Task.create({
        title: "Task to link",
        projectId: testProject._id,
        columnId: testColumn._id,
        createdBy: testUser._id,
      });
    });

    it("should link PR to task", async () => {
      const prId = "507f1f77bcf86cd799439011";

      const response = await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ linkedPRs: [prId] })
        .expect(200);

      expect(response.body.task.linkedPRs).toHaveLength(1);
      expect(response.body.task.linkedPRs[0]).toBe(prId);
    });

    it("should track PR linking in activity", async () => {
      const prId = "507f1f77bcf86cd799439011";

      await request(app)
        .put(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ linkedPRs: [prId] })
        .expect(200);

      const dbTask = await Task.findById(testTask._id);
      const linkActivity = dbTask.activity.find((a) => a.type === "pr_linked");
      expect(linkActivity).toBeTruthy();
    });
  });

  describe("DELETE /api/tasks/:id", () => {
    let testTask;

    beforeEach(async () => {
      testTask = await Task.create({
        title: "Task to delete",
        projectId: testProject._id,
        columnId: testColumn._id,
        createdBy: testUser._id,
      });
    });

    it("should delete task", async () => {
      await request(app)
        .delete(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      const dbTask = await Task.findById(testTask._id);
      expect(dbTask).toBeNull();
    });

    it("should not allow unauthorized user to delete", async () => {
      const otherUser = await global.createTestUser(User, {
        email: "other@test.com",
      });
      const otherToken = global.generateTestToken(otherUser);

      await request(app)
        .delete(`/api/tasks/${testTask._id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);
    });
  });
});