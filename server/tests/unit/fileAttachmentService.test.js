const fileAttachmentService = require("../../src/services/fileAttachmentService");
const File = require("../../src/models/File");
const Task = require("../../src/models/Task");
const PullRequest = require("../../src/models/PullRequest");
const Message = require("../../src/models/Message");
const User = require("../../src/models/User");
const Project = require("../../src/models/Project");

describe("FileAttachmentService Unit Tests", () => {
  let testUser;
  let testProject;
  let testFile;

  beforeEach(async () => {
    testUser = await global.createTestUser(User);
    testProject = await global.createTestProject(Project, testUser._id);

    // Create test file
    testFile = await File.create({
      name: "test-document.pdf",
      path: "/uploads/files/test-document.pdf",
      mimetype: "application/pdf",
      size: 1024000,
      uploadedBy: testUser._id,
      projectId: testProject._id,
    });
  });

  describe("attachToTask", () => {
    let testTask;

    beforeEach(async () => {
      const Column = require("../../src/models/Column");
      const column = await Column.create({
        name: "To Do",
        projectId: testProject._id,
        order: 0,
      });

      testTask = await Task.create({
        title: "Task with attachment",
        projectId: testProject._id,
        columnId: column._id,
        createdBy: testUser._id,
      });
    });

    it("should attach file to task", async () => {
      const result = await fileAttachmentService.attachToTask(
        testFile._id,
        testTask._id,
        testUser._id
      );

      expect(result.success).toBe(true);
      expect(result.file.attachedTo.task).toBe(testTask._id.toString());

      // Verify file document updated
      const updatedFile = await File.findById(testFile._id);
      expect(updatedFile.attachedTo.task.toString()).toBe(testTask._id.toString());
    });

    it("should handle non-existent file", async () => {
      const fakeFileId = "507f1f77bcf86cd799439011";

      const result = await fileAttachmentService.attachToTask(
        fakeFileId,
        testTask._id,
        testUser._id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should handle non-existent task", async () => {
      const fakeTaskId = "507f1f77bcf86cd799439011";

      const result = await fileAttachmentService.attachToTask(
        testFile._id,
        fakeTaskId,
        testUser._id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should prevent duplicate attachment", async () => {
      // First attachment
      await fileAttachmentService.attachToTask(
        testFile._id,
        testTask._id,
        testUser._id
      );

      // Try attaching again
      const result = await fileAttachmentService.attachToTask(
        testFile._id,
        testTask._id,
        testUser._id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("already attached");
    });
  });

  describe("attachToPR", () => {
    let testPR;

    beforeEach(async () => {
      testPR = await PullRequest.create({
        title: "PR with attachment",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        number: 1,
      });
    });

    it("should attach file to pull request", async () => {
      const result = await fileAttachmentService.attachToPR(
        testFile._id,
        testPR._id,
        testUser._id
      );

      expect(result.success).toBe(true);
      expect(result.file.attachedTo.pullRequest).toBe(testPR._id.toString());

      // Verify in database
      const updatedFile = await File.findById(testFile._id);
      expect(updatedFile.attachedTo.pullRequest.toString()).toBe(testPR._id.toString());
    });
  });

  describe("attachToMessage", () => {
    let testMessage;

    beforeEach(async () => {
      testMessage = await Message.create({
        content: "Message with attachment",
        sender: testUser._id,
        projectId: testProject._id,
        type: "text",
      });
    });

    it("should attach file to message", async () => {
      const result = await fileAttachmentService.attachToMessage(
        testFile._id,
        testMessage._id,
        testUser._id
      );

      expect(result.success).toBe(true);
      expect(result.file.attachedTo.message).toBe(testMessage._id.toString());
    });
  });

  describe("getAttachments", () => {
    let task1, task2;

    beforeEach(async () => {
      const Column = require("../../src/models/Column");
      const column = await Column.create({
        name: "To Do",
        projectId: testProject._id,
        order: 0,
      });

      task1 = await Task.create({
        title: "Task 1",
        projectId: testProject._id,
        columnId: column._id,
        createdBy: testUser._id,
      });

      task2 = await Task.create({
        title: "Task 2",
        projectId: testProject._id,
        columnId: column._id,
        createdBy: testUser._id,
      });

      // Attach files to tasks
      await fileAttachmentService.attachToTask(testFile._id, task1._id, testUser._id);

      const file2 = await File.create({
        name: "image.png",
        path: "/uploads/files/image.png",
        mimetype: "image/png",
        size: 500000,
        uploadedBy: testUser._id,
        projectId: testProject._id,
      });

      await fileAttachmentService.attachToTask(file2._id, task2._id, testUser._id);
    });

    it("should get attachments for a task", async () => {
      const attachments = await fileAttachmentService.getAttachments({
        attachedTo: { type: "task", id: task1._id },
      });

      expect(attachments).toHaveLength(1);
      expect(attachments[0].name).toBe("test-document.pdf");
    });

    it("should get attachments for a project", async () => {
      const attachments = await fileAttachmentService.getAttachments({
        projectId: testProject._id,
      });

      expect(attachments.length).toBeGreaterThanOrEqual(2);
    });

    it("should filter attachments by mimetype", async () => {
      const pdfFiles = await fileAttachmentService.getAttachments({
        projectId: testProject._id,
        mimetype: "application/pdf",
      });

      expect(pdfFiles).toHaveLength(1);
      expect(pdfFiles[0].mimetype).toBe("application/pdf");
    });

    it("should filter attachments by uploader", async () => {
      const userFiles = await fileAttachmentService.getAttachments({
        projectId: testProject._id,
        uploadedBy: testUser._id,
      });

      expect(userFiles.length).toBeGreaterThan(0);
      expect(userFiles.every((f) => f.uploadedBy.toString() === testUser._id.toString())).toBe(
        true
      );
    });
  });

  describe("getFileUsage", () => {
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
        title: "Task with file",
        projectId: testProject._id,
        columnId: column._id,
        createdBy: testUser._id,
      });

      testPR = await PullRequest.create({
        title: "PR with file",
        sourceBranch: "feature",
        targetBranch: "main",
        projectId: testProject._id,
        author: testUser._id,
        number: 1,
      });

      // Attach file to both task and PR
      await fileAttachmentService.attachToTask(testFile._id, testTask._id, testUser._id);
      await fileAttachmentService.attachToPR(testFile._id, testPR._id, testUser._id);
    });

    it("should show all usages of a file", async () => {
      const usage = await fileAttachmentService.getFileUsage(testFile._id);

      expect(usage.usageCount).toBe(2);
      expect(usage.attachedTo.task).toBeTruthy();
      expect(usage.attachedTo.pullRequest).toBeTruthy();
      expect(usage.file.name).toBe("test-document.pdf");
    });

    it("should return null for non-existent file", async () => {
      const fakeFileId = "507f1f77bcf86cd799439011";
      const usage = await fileAttachmentService.getFileUsage(fakeFileId);

      expect(usage).toBeNull();
    });
  });

  describe("detachFile", () => {
    let testTask;

    beforeEach(async () => {
      const Column = require("../../src/models/Column");
      const column = await Column.create({
        name: "To Do",
        projectId: testProject._id,
        order: 0,
      });

      testTask = await Task.create({
        title: "Task with attachment",
        projectId: testProject._id,
        columnId: column._id,
        createdBy: testUser._id,
      });

      await fileAttachmentService.attachToTask(testFile._id, testTask._id, testUser._id);
    });

    it("should detach file from task", async () => {
      const result = await fileAttachmentService.detachFile(
        testFile._id,
        "task",
        testTask._id
      );

      expect(result.success).toBe(true);

      // Verify file detached
      const updatedFile = await File.findById(testFile._id);
      expect(updatedFile.attachedTo.task).toBeNull();
    });

    it("should handle detaching from wrong type", async () => {
      const result = await fileAttachmentService.detachFile(
        testFile._id,
        "pullRequest",
        testTask._id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("not attached");
    });
  });

  describe("searchFiles", () => {
    beforeEach(async () => {
      await File.create([
        {
          name: "authentication-guide.pdf",
          path: "/uploads/files/auth-guide.pdf",
          mimetype: "application/pdf",
          size: 2048000,
          uploadedBy: testUser._id,
          projectId: testProject._id,
        },
        {
          name: "authentication-flow.png",
          path: "/uploads/files/auth-flow.png",
          mimetype: "image/png",
          size: 512000,
          uploadedBy: testUser._id,
          projectId: testProject._id,
        },
        {
          name: "deployment-script.sh",
          path: "/uploads/files/deploy.sh",
          mimetype: "application/x-sh",
          size: 10240,
          uploadedBy: testUser._id,
          projectId: testProject._id,
        },
      ]);
    });

    it("should search files by name", async () => {
      const results = await fileAttachmentService.searchFiles({
        projectId: testProject._id,
        searchTerm: "authentication",
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((f) => f.name.toLowerCase().includes("authentication"))).toBe(
        true
      );
    });

    it("should search files by mimetype filter", async () => {
      const pdfFiles = await fileAttachmentService.searchFiles({
        projectId: testProject._id,
        mimetype: "application/pdf",
      });

      expect(pdfFiles.length).toBeGreaterThan(0);
      expect(pdfFiles.every((f) => f.mimetype === "application/pdf")).toBe(true);
    });

    it("should search and sort by size", async () => {
      const results = await fileAttachmentService.searchFiles({
        projectId: testProject._id,
        sortBy: "size",
        sortOrder: "desc",
      });

      expect(results.length).toBeGreaterThan(0);
      // Verify descending order
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].size).toBeGreaterThanOrEqual(results[i + 1].size);
      }
    });

    it("should limit search results", async () => {
      const results = await fileAttachmentService.searchFiles({
        projectId: testProject._id,
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });
});
