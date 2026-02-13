const notificationService = require("../../src/services/notificationService");
const Notification = require("../../src/models/Notification");
const User = require("../../src/models/User");
const Task = require("../../src/models/Task");
const PullRequest = require("../../src/models/PullRequest");

describe("NotificationService Unit Tests", () => {
  let mockIo;
  let testUser;
  let testProject;

  beforeEach(async () => {
    // Mock Socket.io
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    notificationService.setIO(mockIo);

    // Create test user
    testUser = await global.createTestUser(User);
    testProject = await global.createTestProject(
      require("../../src/models/Project"),
      testUser._id
    );
  });

  describe("createNotification", () => {
    it("should create notification in database", async () => {
      const notification = await notificationService.createNotification({
        userId: testUser._id,
        type: "task_assigned",
        message: "You were assigned to a task",
        projectId: testProject._id,
        referenceId: null,
        payload: { taskTitle: "Test Task" },
      });

      expect(notification).toBeTruthy();
      expect(notification.userId.toString()).toBe(testUser._id.toString());
      expect(notification.type).toBe("task_assigned");
      expect(notification.read).toBe(false);

      // Verify in database
      const dbNotification = await Notification.findById(notification._id);
      expect(dbNotification).toBeTruthy();
    });

    it("should emit real-time notification via Socket.io", async () => {
      await notificationService.createNotification({
        userId: testUser._id,
        type: "task_assigned",
        message: "You were assigned to a task",
        projectId: testProject._id,
      });

      expect(mockIo.to).toHaveBeenCalledWith(`user:${testUser._id}`);
      expect(mockIo.emit).toHaveBeenCalledWith(
        "notification",
        expect.objectContaining({
          type: "task_assigned",
          message: "You were assigned to a task",
        })
      );
    });

    it("should handle missing Socket.io gracefully", async () => {
      notificationService.setIO(null);

      const notification = await notificationService.createNotification({
        userId: testUser._id,
        type: "task_assigned",
        message: "Test",
      });

      expect(notification).toBeTruthy();
      // Should not crash
    });
  });

  describe("notifyTaskAssigned", () => {
    let assignee1, assignee2, assigner;

    beforeEach(async () => {
      assignee1 = await global.createTestUser(User, { email: "assignee1@test.com" });
      assignee2 = await global.createTestUser(User, { email: "assignee2@test.com" });
      assigner = await global.createTestUser(User, { email: "assigner@test.com" });
    });

    it("should notify all assignees", async () => {
      await notificationService.notifyTaskAssigned({
        taskId: "task123",
        taskTitle: "Implement feature X",
        assigneeIds: [assignee1._id, assignee2._id],
        assignedBy: assigner._id,
        projectId: testProject._id,
      });

      const notifications = await Notification.find({
        userId: { $in: [assignee1._id, assignee2._id] },
      });

      expect(notifications).toHaveLength(2);
      expect(notifications.every((n) => n.type === "task_assigned")).toBe(true);
      expect(notifications.every((n) => n.message.includes("Implement feature X"))).toBe(
        true
      );
    });

    it("should not notify the assigner", async () => {
      await notificationService.notifyTaskAssigned({
        taskId: "task123",
        taskTitle: "Test Task",
        assigneeIds: [assigner._id, assignee1._id],
        assignedBy: assigner._id,
        projectId: testProject._id,
      });

      const assignerNotification = await Notification.findOne({
        userId: assigner._id,
        type: "task_assigned",
      });

      // Assigner should not receive self-notification
      expect(assignerNotification).toBeNull();
    });
  });

  describe("notifyPRCreated", () => {
    let author, reviewer1, reviewer2;

    beforeEach(async () => {
      author = await global.createTestUser(User, { email: "author@test.com" });
      reviewer1 = await global.createTestUser(User, { email: "reviewer1@test.com" });
      reviewer2 = await global.createTestUser(User, { email: "reviewer2@test.com" });
    });

    it("should notify all reviewers", async () => {
      await notificationService.notifyPRCreated({
        prId: "pr123",
        prNumber: 42,
        prTitle: "Add authentication",
        authorId: author._id,
        projectId: testProject._id,
        reviewers: [reviewer1._id, reviewer2._id],
      });

      const notifications = await Notification.find({
        userId: { $in: [reviewer1._id, reviewer2._id] },
        type: "pr_created",
      });

      expect(notifications).toHaveLength(2);
      expect(notifications.every((n) => n.message.includes("PR #42"))).toBe(true);
    });

    it("should not notify the author", async () => {
      await notificationService.notifyPRCreated({
        prId: "pr123",
        prNumber: 42,
        prTitle: "Test PR",
        authorId: author._id,
        projectId: testProject._id,
        reviewers: [author._id, reviewer1._id],
      });

      const authorNotification = await Notification.findOne({
        userId: author._id,
        type: "pr_created",
      });

      expect(authorNotification).toBeNull();
    });
  });

  describe("notifyPRMerged", () => {
    let author, reviewer, merger;

    beforeEach(async () => {
      author = await global.createTestUser(User, { email: "author@test.com" });
      reviewer = await global.createTestUser(User, { email: "reviewer@test.com" });
      merger = await global.createTestUser(User, { email: "merger@test.com" });
    });

    it("should notify author and watchers", async () => {
      await notificationService.notifyPRMerged({
        prId: "pr123",
        prNumber: 42,
        prTitle: "Feature PR",
        mergerId: merger._id,
        authorId: author._id,
        projectId: testProject._id,
        watchers: [reviewer._id],
      });

      const notifications = await Notification.find({
        type: "pr_merged",
      });

      expect(notifications.length).toBeGreaterThan(0);
      
      // Author should be notified
      const authorNotif = notifications.find(
        (n) => n.userId.toString() === author._id.toString()
      );
      expect(authorNotif).toBeTruthy();

      // Merger should NOT be notified
      const mergerNotif = notifications.find(
        (n) => n.userId.toString() === merger._id.toString()
      );
      expect(mergerNotif).toBeUndefined();
    });
  });

  describe("notifyFileUploaded", () => {
    it("should notify watchers with context", async () => {
      const uploader = await global.createTestUser(User, { email: "uploader@test.com" });
      const watcher = await global.createTestUser(User, { email: "watcher@test.com" });

      await notificationService.notifyFileUploaded({
        fileId: "file123",
        fileName: "document.pdf",
        uploaderId: uploader._id,
        projectId: testProject._id,
        attachedTo: { type: "task", title: "Important Task" },
        watchers: [watcher._id, uploader._id],
      });

      const notification = await Notification.findOne({
        userId: watcher._id,
        type: "file_uploaded",
      });

      expect(notification).toBeTruthy();
      expect(notification.message).toContain("document.pdf");
      expect(notification.message).toContain("Important Task");
    });
  });

  describe("notifyMany", () => {
    it("should handle batch notifications", async () => {
      const users = await Promise.all([
        global.createTestUser(User, { email: "user1@test.com" }),
        global.createTestUser(User, { email: "user2@test.com" }),
        global.createTestUser(User, { email: "user3@test.com" }),
      ]);

      const notifications = users.map((user) => ({
        userId: user._id,
        type: "test_notification",
        message: "Batch test",
        projectId: testProject._id,
      }));

      const results = await notificationService.notifyMany(notifications);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);

      const dbNotifications = await Notification.find({
        type: "test_notification",
      });
      expect(dbNotifications).toHaveLength(3);
    });
  });
});
