# Task System - Testing Guide

## Local Testing Setup

### Prerequisites
- Node.js 16+ installed
- MongoDB running (local or Docker)
- Two browser windows for real-time testing

### Backend Testing

#### 1. Unit & Integration Tests

```bash
cd server
npm install
npm test -- tests/task.test.js
```

**Expected Output:**
```
Task API Integration Tests
  ✓ POST /api/tasks/:projectId - should create a new task (125ms)
  ✓ POST /api/tasks/:projectId - should fail without title (45ms)
  ... (all tests passing)
  
Tests: 28 passed, 28 total
```

#### 2. Manual API Testing with cURL

**Create Task:**
```bash
# Get auth token first
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token')

# Create task
curl -X POST http://localhost:5000/api/tasks/PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement login page",
    "description": "Add JWT authentication UI",
    "priority": "high",
    "assignees": ["USER_ID"]
  }'
```

**Get Tasks with Filters:**
```bash
curl -X GET "http://localhost:5000/api/tasks/PROJECT_ID?status=in_progress&priority=high" \
  -H "Authorization: Bearer $TOKEN"
```

**Move Task:**
```bash
curl -X POST http://localhost:5000/api/tasks/TASK_ID/move \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"toStatus": "in_progress", "toOrderKey": 2000}'
```

#### 3. Socket Testing with Node Client

Create `test-socket.js`:
```javascript
const io = require('socket.io-client');

const token = 'YOUR_JWT_TOKEN';
const projectId = 'PROJECT_ID';

const socket = io('http://localhost:5000', {
  auth: { token },
});

socket.on('connect', () => {
  console.log('✓ Connected');
  socket.emit('joinProjectTasks', { projectId });
});

socket.on('joinedProjectTasks', () => {
  console.log('✓ Joined project tasks room');
});

socket.on('task:created', (data) => {
  console.log('✓ Task created:', data.task.title);
});

socket.on('task:moved', (data) => {
  console.log('✓ Task moved:', data.taskId, data.fromStatus, '->', data.toStatus);
});

socket.on('error', (error) => {
  console.error('✗ Error:', error);
});

// Run: node test-socket.js
```

### Frontend Testing

#### 1. Manual Acceptance Tests

**Test Scenario 1: Create and View Task**

1. Navigate to `http://localhost:5173/projects/:projectId/tasks`
2. Click "New Task" button
3. Fill in:
   - Title: "Implement logout feature"
   - Priority: High
   - Due Date: (tomorrow)
4. Click "Create"

**Expected Results:**
- ✅ Task appears in "To Do" column immediately
- ✅ Task card shows title, priority badge (orange), due date
- ✅ Browser console shows no errors
- ✅ Refresh page - task persists

**Test Scenario 2: Real-time Collaboration**

1. Open project in Chrome: `http://localhost:5173/projects/:id/tasks`
2. Open same project in Firefox (different user logged in)
3. In Chrome, create a new task
4. **Expected:** Firefox shows the new task within 2 seconds without refresh

**Test Scenario 3: Drag & Drop**

1. Drag a task from "To Do" to "In Progress"
2. **Expected:**
   - Task moves smoothly with visual feedback (rotation, shadow)
   - Task appears in new column immediately
   - After API call completes, refresh shows task in new column
   - Other connected users see the move in real-time

**Test Scenario 4: Link Pull Request**

1. Create a task
2. Create a PR in the same project
3. Open task detail modal
4. Click "Link PR" (you may need to implement this UI)
5. Select the PR from dropdown
6. **Expected:**
   - PR link appears in task modal
   - Task card shows PR badge with PR number
7. Try to drag task to "Review" column
8. **Expected:** Move succeeds (because PR is linked)
9. Create a new task (no PR)
10. Try to drag to "Review"
11. **Expected:** Failure or warning (PR required)

**Test Scenario 5: Filters**

1. Create 5 tasks:
   - 2 with priority "high"
   - 2 with label "backend"
   - 1 with priority "low"
2. Click "Filters" button
3. Select priority "high"
4. **Expected:** Only 2 tasks visible
5. Add label filter "backend"
6. **Expected:** Only tasks matching BOTH filters visible
7. Click "Clear all"
8. **Expected:** All 5 tasks visible again

**Test Scenario 6: Search**

1. Create tasks: "Fix login bug", "Add login tests", "Update README"
2. Type "login" in search box
3. **Expected:** Only "Fix login bug" and "Add login tests" visible
4. Clear search
5. **Expected:** All tasks visible

#### 2. Automated E2E Tests (Cypress)

Create `client/cypress/e2e/tasks.cy.js`:

```javascript
describe('Tasks/Kanban Board', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/projects/PROJECT_ID/tasks');
  });

  it('should create a new task', () => {
    cy.contains('New Task').click();
    cy.get('input[placeholder*="title"]').type('New E2E Task');
    cy.get('textarea').type('This is a test task');
    cy.get('select').first().select('high');
    cy.contains('Create Task').click();
    
    cy.contains('New E2E Task').should('be.visible');
  });

  it('should drag task to new column', () => {
    // Create a task first
    cy.createTask('Test Drag');
    
    // Drag from "To Do" to "In Progress"
    cy.contains('Test Drag')
      .parent()
      .drag('[data-droppable-id="in_progress"]');
    
    // Verify task moved
    cy.get('[data-droppable-id="in_progress"]')
      .should('contain', 'Test Drag');
  });

  it('should filter tasks by priority', () => {
    cy.contains('Filters').click();
    cy.contains('high').click();
    
    cy.get('[data-testid="task-card"]').each(($el) => {
      cy.wrap($el).should('contain', 'high');
    });
  });

  it('should open task detail modal', () => {
    cy.createTask('Modal Test');
    cy.contains('Modal Test').click();
    
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Description').should('be.visible');
  });

  it('should show real-time updates', () => {
    // Use second browser session or WebSocket mock
    cy.window().then((win) => {
      win.io.emit('task:created', {
        task: { title: 'Real-time Task', status: 'todo' }
      });
    });
    
    cy.contains('Real-time Task', { timeout: 3000 }).should('be.visible');
  });
});
```

Run:
```bash
cd client
npm run cypress
# Or for headless
npm run cypress:run
```

### Performance Testing

#### 1. Load Testing with k6

Create `load-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 50, // 50 virtual users
  duration: '30s',
};

const TOKEN = 'YOUR_JWT_TOKEN';
const PROJECT_ID = 'PROJECT_ID';

export default function() {
  // Fetch tasks
  let res = http.get(`http://localhost:5000/api/tasks/${PROJECT_ID}`, {
    headers: { 'Authorization': `Bearer ${TOKEN}` },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Create task
  res = http.post(`http://localhost:5000/api/tasks/${PROJECT_ID}`, 
    JSON.stringify({
      title: `Load test task ${__VU}-${__ITER}`,
      priority: 'medium',
    }), {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  check(res, {
    'create task status is 201': (r) => r.status === 201,
  });

  sleep(1);
}
```

Run:
```bash
k6 run load-test.js
```

**Expected Results:**
- Avg response time < 200ms for GET requests
- Avg response time < 500ms for POST requests
- 95th percentile < 1s
- 0% error rate

#### 2. Frontend Performance (Lighthouse)

```bash
cd client
npm run build
npm run preview

# In another terminal
lighthouse http://localhost:4173/projects/ID/tasks --view
```

**Target Scores:**
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 90

### Acceptance Test Checklist

Use this checklist for manual QA before pushing to production:

#### Core Functionality
- [ ] Create task with all fields
- [ ] Create task with only title (required field)
- [ ] View task list
- [ ] Open task detail modal
- [ ] Edit task title, description, priority
- [ ] Delete task
- [ ] Drag task to new column
- [ ] Task persists after refresh

#### Real-time Features
- [ ] Second user sees task creation in real-time
- [ ] Second user sees task moves in real-time
- [ ] Second user sees task updates in real-time
- [ ] Socket reconnects after network interruption

#### Integrations
- [ ] Link existing PR to task
- [ ] PR badge shows on task card
- [ ] Cannot move to Review without PR (if enforced)
- [ ] Attach file to task
- [ ] File count badge updates
- [ ] Create task from chat message (if implemented)
- [ ] Open chat from task (if implemented)

#### Filters & Search
- [ ] Filter by status (single)
- [ ] Filter by priority (multiple)
- [ ] Filter by assignee
- [ ] Search by title
- [ ] Search by description
- [ ] Clear all filters
- [ ] Active filter chips show

#### Bulk Operations (if implemented)
- [ ] Select multiple tasks
- [ ] Bulk move to different status
- [ ] Bulk assign to user
- [ ] Bulk change priority

#### Notifications
- [ ] Assignee receives notification on assignment
- [ ] PR reviewers notified on task move to Review
- [ ] Notification appears in bell icon

#### Analytics
- [ ] Analytics page shows correct counts
- [ ] Completion rate calculates correctly
- [ ] User productivity chart displays

#### Permissions
- [ ] Non-member cannot access /api/tasks
- [ ] Non-member cannot connect to socket
- [ ] Member can edit own tasks
- [ ] Owner can edit all tasks

#### UI/UX
- [ ] Responsive on mobile (< 768px)
- [ ] Dark mode works
- [ ] No console errors
- [ ] Loading states show
- [ ] Error messages are clear
- [ ] Empty states display correctly

#### Performance
- [ ] Page loads < 2s
- [ ] Drag & drop is smooth (60fps)
- [ ] No lag with 50+ tasks
- [ ] Socket events arrive < 500ms

### Debugging Tips

**Socket not connecting:**
```javascript
// In browser console
localStorage.getItem('token') // Check if token exists
socket.io.readyState // Check connection state
```

**Tasks not updating:**
```javascript
// Check Redux/state
console.log(store.getState().tasks)

// Check socket listeners
socket.eventNames()
```

**Drag & drop issues:**
```javascript
// Enable draggable debugging
<Draggable draggableId={task._id} index={index} isDragDisabled={false}>
  {(provided, snapshot) => {
    console.log('Dragging:', snapshot.isDragging);
    ...
  }}
</Draggable>
```

**API errors:**
```bash
# Check server logs
cd server
npm run dev -- --debug

# Or with detailed logging
DEBUG=* npm run dev
```

### CI/CD Testing

**GitHub Actions Workflow** (`.github/workflows/test.yml`):

```yaml
name: Task System Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:6
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install backend dependencies
        run: cd server && npm ci
      
      - name: Run backend tests
        run: cd server && npm test
        env:
          MONGODB_TEST_URI: mongodb://localhost:27017/test
          JWT_SECRET: test_secret
      
      - name: Install frontend dependencies
        run: cd client && npm ci
      
      - name: Run frontend tests
        run: cd client && npm test
      
      - name: Build frontend
        run: cd client && npm run build
```

### Test Data Seeding

For consistent testing, seed test data:

**seed-test-data.js:**
```javascript
const mongoose = require('mongoose');
const Task = require('./src/models/Task');
const Project = require('./src/models/Project');
const User = require('./src/models/User');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Create test user
  const user = await User.create({
    username: 'testuser',
    email: 'test@devcollab.com',
    password: 'Password123!',
  });
  
  // Create test project
  const project = await Project.create({
    name: 'Test Project',
    owner: user._id,
    members: [{ user: user._id, role: 'owner' }],
  });
  
  // Create test tasks
  const statuses = ['todo', 'in_progress', 'review', 'done'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  
  for (let i = 0; i < 20; i++) {
    await Task.create({
      projectId: project._id,
      title: `Test Task ${i + 1}`,
      description: `Description for task ${i + 1}`,
      status: statuses[i % 4],
      priority: priorities[i % 4],
      createdBy: user._id,
      orderKey: (i + 1) * 1000,
    });
  }
  
  console.log('✓ Seeded test data');
  process.exit(0);
}

seed();
```

Run:
```bash
node seed-test-data.js
```

---

## Troubleshooting Common Test Failures

### Test: "should create a new task"
**Failure:** 401 Unauthorized
**Fix:** Check JWT token generation, ensure `JWT_SECRET` is set in test env

### Test: "should receive task:created event"
**Failure:** Event not received
**Fix:** 
1. Check socket connection in test setup
2. Verify `io.to()` room name matches
3. Add delay: `await new Promise(resolve => setTimeout(resolve, 100))`

### Test: "should move task and update orderKey"
**Failure:** orderKey not updated
**Fix:** Check transaction in `moveTaskAcrossColumns`, ensure `session.commitTransaction()` is called

### E2E Test: Drag & drop fails
**Fix:** Use `@hello-pangea/dnd` instead of `react-beautiful-dnd`, ensure `DragDropContext` wraps board

---

## Next Steps

After all tests pass:
1. Deploy to staging environment
2. Run full regression suite
3. Perform UAT (User Acceptance Testing)
4. Monitor production metrics (Datadog/New Relic)
5. Set up error tracking (Sentry)

---

**Document Version:** 1.0  
**Last Updated:** February 10, 2026
