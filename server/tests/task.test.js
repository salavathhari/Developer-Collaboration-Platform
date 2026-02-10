const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Task = require('../src/models/Task');
const Project = require('../src/models/Project');
const User = require('../src/models/User');
const PullRequest = require('../src/models/PullRequest');
const File = require('../src/models/File');
const jwt = require('jsonwebtoken');

describe('Task API Integration Tests', () => {
  let token, userId, projectId, taskId;
  let secondUser, secondToken;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/devcollab_test');
    }

    // Create test user
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
    });
    userId = user._id;
    token = jwt.sign({ sub: userId }, process.env.JWT_SECRET || 'testsecret');

    // Create second user for collaboration tests
    secondUser = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'Password123!',
    });
    secondToken = jwt.sign({ sub: secondUser._id }, process.env.JWT_SECRET || 'testsecret');

    // Create test project
    const project = await Project.create({
      name: 'Test Project',
      description: 'Test project for task tests',
      owner: userId,
      members: [
        { user: userId, role: 'owner' },
        { user: secondUser._id, role: 'member' },
      ],
    });
    projectId = project._id;
  });

  afterAll(async () => {
    // Clean up test data
    await Task.deleteMany({});
    await Project.deleteMany({});
    await User.deleteMany({});
    await PullRequest.deleteMany({});
    await File.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/tasks/:projectId', () => {
    it('should create a new task with required fields', async () => {
      const res = await request(app)
        .post(`/api/tasks/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Implement authentication',
          description: 'Add JWT-based authentication',
          priority: 'high',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.task).toHaveProperty('_id');
      expect(res.body.task.title).toBe('Implement authentication');
      expect(res.body.task.priority).toBe('high');
      expect(res.body.task.status).toBe('todo');
      expect(res.body.task.createdBy._id).toBe(userId.toString());
      expect(res.body.task).toHaveProperty('orderKey');

      taskId = res.body.task._id;
    });

    it('should fail without title', async () => {
      const res = await request(app)
        .post(`/api/tasks/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'No title provided' });

      expect(res.status).toBe(400);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post(`/api/tasks/${projectId}`)
        .send({ title: 'Unauthorized task' });

      expect(res.status).toBe(401);
    });

    it('should fail for non-project member', async () => {
      const nonMember = await User.create({
        username: 'nonmember',
        email: 'nonmember@example.com',
        password: 'Password123!',
      });
      const nonMemberToken = jwt.sign({ sub: nonMember._id }, process.env.JWT_SECRET || 'testsecret');

      const res = await request(app)
        .post(`/api/tasks/${projectId}`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({ title: 'Should fail' });

      expect(res.status).toBe(403);
    });

    it('should create task with all optional fields', async () => {
      const res = await request(app)
        .post(`/api/tasks/${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Complete task',
          description: 'Task with all fields',
          priority: 'critical',
          status: 'in_progress',
          assignees: [userId, secondUser._id],
          dueDate: '2026-03-15',
          labels: ['backend', 'urgent'],
        });

      expect(res.status).toBe(201);
      expect(res.body.task.assignees).toHaveLength(2);
      expect(res.body.task.labels).toContain('backend');
      expect(res.body.task.dueDate).toBeDefined();
    });
  });

  describe('GET /api/tasks/:projectId', () => {
    beforeAll(async () => {
      // Create sample tasks
      await Task.create([
        {
          projectId,
          title: 'Task 1',
          priority: 'low',
          status: 'todo',
          createdBy: userId,
          orderKey: 1000,
        },
        {
          projectId,
          title: 'Task 2',
          priority: 'high',
          status: 'in_progress',
          createdBy: userId,
          orderKey: 2000,
        },
        {
          projectId,
          title: 'Task 3',
          priority: 'high',
          status: 'done',
          createdBy: userId,
          orderKey: 3000,
        },
      ]);
    });

    it('should fetch all tasks for a project', async () => {
      const res = await request(app)
        .get(`/api/tasks/${projectId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tasks).toBeInstanceOf(Array);
      expect(res.body.tasks.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty('total');
    });

    it('should filter tasks by status', async () => {
      const res = await request(app)
        .get(`/api/tasks/${projectId}?status=in_progress`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks.every((t) => t.status === 'in_progress')).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const res = await request(app)
        .get(`/api/tasks/${projectId}?priority=high`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks.every((t) => t.priority === 'high')).toBe(true);
    });

    it('should search tasks by title', async () => {
      const res = await request(app)
        .get(`/api/tasks/${projectId}?search=Task 1`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tasks.some((t) => t.title.includes('Task 1'))).toBe(true);
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get(`/api/tasks/${projectId}?limit=2&offset=1`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(2);
      expect(res.body.offset).toBe(1);
    });
  });

  describe('PUT /api/tasks/:taskId', () => {
    let updateTaskId;

    beforeEach(async () => {
      const task = await Task.create({
        projectId,
        title: 'Task to update',
        status: 'todo',
        priority: 'medium',
        createdBy: userId,
      });
      updateTaskId = task._id;
    });

    it('should update task title', async () => {
      const res = await request(app)
        .put(`/api/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated title' });

      expect(res.status).toBe(200);
      expect(res.body.task.title).toBe('Updated title');
    });

    it('should update task status', async () => {
      const res = await request(app)
        .put(`/api/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('in_progress');
      expect(res.body.changedFields).toContain('status');
    });

    it('should update assignees', async () => {
      const res = await request(app)
        .put(`/api/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignees: [secondUser._id] });

      expect(res.status).toBe(200);
      expect(res.body.task.assignees).toHaveLength(1);
    });

    it('should add activity on update', async () => {
      await request(app)
        .put(`/api/tasks/${updateTaskId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ priority: 'high' });

      const task = await Task.findById(updateTaskId);
      expect(task.activity.length).toBeGreaterThan(0);
      expect(task.activity.some((a) => a.type === 'updated')).toBe(true);
    });
  });

  describe('POST /api/tasks/:taskId/move', () => {
    let moveTaskId;

    beforeEach(async () => {
      const task = await Task.create({
        projectId,
        title: 'Task to move',
        status: 'todo',
        createdBy: userId,
        orderKey: 1000,
      });
      moveTaskId = task._id;
    });

    it('should move task to new status', async () => {
      const res = await request(app)
        .post(`/api/tasks/${moveTaskId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'in_progress', toOrderKey: 2000 });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('in_progress');
      expect(res.body.task.orderKey).toBe(2000);
      expect(res.body.fromStatus).toBe('todo');
      expect(res.body.toStatus).toBe('in_progress');
    });

    it('should validate moving to review without PR', async () => {
      const res = await request(app)
        .post(`/api/tasks/${moveTaskId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'review', requirePRForReview: true });

      expect(res.status).toBe(400);
    });

    it('should allow moving to review with linked PR', async () => {
      const pr = await PullRequest.create({
        projectId,
        number: 1,
        title: 'Test PR',
        author: userId,
        baseBranch: 'main',
        headBranch: 'feature',
        status: 'open',
      });

      const task = await Task.findById(moveTaskId);
      task.linkedPRId = pr._id;
      await task.save();

      const res = await request(app)
        .post(`/api/tasks/${moveTaskId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ toStatus: 'review', requirePRForReview: true });

      expect(res.status).toBe(200);
      expect(res.body.task.status).toBe('review');
    });
  });

  describe('POST /api/tasks/:taskId/link-pr', () => {
    let linkTaskId, prId;

    beforeEach(async () => {
      const task = await Task.create({
        projectId,
        title: 'Task to link PR',
        status: 'todo',
        createdBy: userId,
      });
      linkTaskId = task._id;

      const pr = await PullRequest.create({
        projectId,
        number: 2,
        title: 'PR to link',
        author: userId,
        baseBranch: 'main',
        headBranch: 'feature-2',
        status: 'open',
      });
      prId = pr._id;
    });

    it('should link PR to task', async () => {
      const res = await request(app)
        .post(`/api/tasks/${linkTaskId}/link-pr`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prId });

      expect(res.status).toBe(200);
      expect(res.body.task.linkedPRId).toBeDefined();
    });

    it('should fail to link PR from different project', async () => {
      const otherProject = await Project.create({
        name: 'Other Project',
        owner: userId,
        members: [{ user: userId, role: 'owner' }],
      });

      const otherPR = await PullRequest.create({
        projectId: otherProject._id,
        number: 3,
        title: 'Other PR',
        author: userId,
        baseBranch: 'main',
        headBranch: 'feature-3',
        status: 'open',
      });

      const res = await request(app)
        .post(`/api/tasks/${linkTaskId}/link-pr`)
        .set('Authorization', `Bearer ${token}`)
        .send({ prId: otherPR._id });

      expect(res.status).toBe(500); // or 400 depending on error handling
    });
  });

  describe('POST /api/tasks/:taskId/link-file', () => {
    let linkFileTaskId, fileId;

    beforeEach(async () => {
      const task = await Task.create({
        projectId,
        title: 'Task to link file',
        status: 'todo',
        createdBy: userId,
      });
      linkFileTaskId = task._id;

      const file = await File.create({
        projectId,
        name: 'test.pdf',
        path: '/uploads/test.pdf',
        size: 1024,
        uploadedBy: userId,
      });
      fileId = file._id;
    });

    it('should link file to task', async () => {
      const res = await request(app)
        .post(`/api/tasks/${linkFileTaskId}/link-file`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileId });

      expect(res.status).toBe(200);
      expect(res.body.task.linkedFiles).toContain(fileId.toString());
    });
  });

  describe('POST /api/tasks/bulk-update', () => {
    let bulkTaskIds;

    beforeEach(async () => {
      const tasks = await Task.create([
        { projectId, title: 'Bulk 1', status: 'todo', createdBy: userId },
        { projectId, title: 'Bulk 2', status: 'todo', createdBy: userId },
        { projectId, title: 'Bulk 3', status: 'todo', createdBy: userId },
      ]);
      bulkTaskIds = tasks.map((t) => t._id);
    });

    it('should bulk update multiple tasks', async () => {
      const res = await request(app)
        .post('/api/tasks/bulk-update')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId,
          taskIds: bulkTaskIds,
          changes: { status: 'done', priority: 'low' },
        });

      expect(res.status).toBe(200);
      expect(res.body.results.successful).toHaveLength(3);

      const updatedTasks = await Task.find({ _id: { $in: bulkTaskIds } });
      expect(updatedTasks.every((t) => t.status === 'done')).toBe(true);
      expect(updatedTasks.every((t) => t.priority === 'low')).toBe(true);
    });
  });

  describe('GET /api/tasks/:projectId/analytics', () => {
    beforeAll(async () => {
      // Clear existing tasks
      await Task.deleteMany({ projectId });

      // Create tasks for analytics
      await Task.create([
        { projectId, title: 'A1', status: 'todo', priority: 'low', createdBy: userId },
        { projectId, title: 'A2', status: 'in_progress', priority: 'medium', createdBy: userId },
        { projectId, title: 'A3', status: 'done', priority: 'high', createdBy: userId },
        { projectId, title: 'A4', status: 'done', priority: 'high', createdBy: userId },
      ]);
    });

    it('should return analytics data', async () => {
      const res = await request(app)
        .get(`/api/tasks/${projectId}/analytics`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('completed');
      expect(res.body).toHaveProperty('completionRate');
      expect(res.body).toHaveProperty('byStatus');
      expect(res.body).toHaveProperty('byPriority');
      expect(res.body.total).toBe(4);
      expect(res.body.completed).toBe(2);
      expect(parseFloat(res.body.completionRate)).toBe(50.0);
    });
  });

  describe('DELETE /api/tasks/:taskId', () => {
    let deleteTaskId;

    beforeEach(async () => {
      const task = await Task.create({
        projectId,
        title: 'Task to delete',
        status: 'todo',
        createdBy: userId,
      });
      deleteTaskId = task._id;
    });

    it('should delete a task', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${deleteTaskId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      const task = await Task.findById(deleteTaskId);
      expect(task).toBeNull();
    });
  });
});
