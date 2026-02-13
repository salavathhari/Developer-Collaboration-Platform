# System Architecture Documentation
## Developer Collaboration Platform

**Version:** 1.0.0  
**Last Updated:** February 13, 2026  
**Architecture Type:** Microservices-ready Monolith (Modular MERN Stack)

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [API Design](#api-design)
8. [Real-Time Architecture](#real-time-architecture)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)
11. [Scaling Strategy](#scaling-strategy)

---

## System Overview

###Purpose
A comprehensive developer collaboration platform enabling teams to manage projects with integrated task management, pull request workflows, real-time communication, and AI assistance.

### Key Features
- **Project Management**: Workspaces with role-based access control
- **Task Management**: Kanban boards with custom workflows
- **Code Collaboration**: Git-like pull request system with reviews
- **Real-Time Communication**: Chat, video calls, presence tracking
- **File Management**: Attachment system linked to tasks/PRs/messages
- **AI Integration**: OpenAI-powered code assistance
- **Analytics**: Project insights and team performance metrics

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  React 19 SPA + Vite                                            │
│  - Redux Toolkit (State Management)                              │
│  - React Router (Navigation)                                     │
│  - Socket.io Client (WebSocket)                                  │
│  - Simple-Peer (WebRTC)                                          │
│  - TailwindCSS (Styling)                                         │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS / WSS
                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY (Nginx)                        │
├─────────────────────────────────────────────────────────────────┤
│  - SSL Termination                                               │
│  - Load Balancing                                                │
│  - Static Asset Serving (CDN)                                    │
│  - Request Routing                                               │
│  - Compression (gzip)                                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ↓                           ↓
┌──────────────────┐       ┌──────────────────┐
│  REST API        │       │  WebSocket       │
│  (Express 5)     │       │  (Socket.io)     │
└────────┬─────────┘       └────────┬─────────┘
         │                          │
         └──────────┬───────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Node.js 22 + Express 5                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MIDDLEWARE                                               │   │
│  │  - Authentication (JWT)                                   │   │
│  │  - Rate Limiting                                          │   │
│  │  - Request Validation                                     │   │
│  │  - Error Handling                                         │   │
│  │  - Logging (Winston)                                      │   │
│  │  - Security Headers (Helmet)                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CONTROLLERS                                              │   │
│  │  - Auth Controller                                        │   │
│  │  - Project Controller                                     │   │
│  │  - Task Controller                                        │   │
│  │  - PR Controller                                          │   │
│  │  - File Controller                                        │   │
│  │  - Message Controller                                     │   │
│  │  - User Controller                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SERVICES                                                 │   │
│  │  - Notification Service (unified)                         │   │
│  │  - File Attachment Service                                │   │
│  │  - Task Service                                           │   │
│  │  - Email Service                                          │   │
│  │  - Storage Service (S3/local)                             │   │
│  │  - AI Service (OpenAI integration)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  SOCKET HANDLERS                                          │   │
│  │  - Chat Events                                            │   │
│  │  - Presence Tracking                                      │   │
│  │  - Notification Delivery                                  │   │
│  │  - Real-time Updates                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────┬───────────────────────────┘
            │                         │
            ↓                         ↓
┌──────────────────────┐   ┌──────────────────────┐
│   MongoDB 7.0        │   │   Redis 7.0          │
├──────────────────────┤   ├──────────────────────┤
│  - Primary Database  │   │  - Session Store     │
│  - Document Store    │   │  - Cache Layer       │
│  - Indexes optimize  │   │  - Rate Limiting     │
│  - Replica Set       │   │  - Real-time data    │
└──────────────────────┘   └──────────────────────┘
            │
            ↓
┌──────────────────────────────────┐
│   External Services              │
├──────────────────────────────────┤
│  - AWS S3 (File Storage)         │
│  - SMTP Service (Email)          │
│  - Sentry (Error Tracking)       │
│  - OpenAI API (AI Assistant)     │
│  - Firebase (Push Notifications) │
└──────────────────────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| Redux Toolkit | 2.6.0 | State Management |
| React Router | 7.6.7 | Client-side Routing |
| Socket.io Client | 4.8.3 | WebSocket Client |
| Simple-Peer | 9.11.1 | WebRTC Video Calls |
| TailwindCSS | 3.4.20 | Styling |
| Vite | 6.3.5 | Build Tool |
| TypeScript | 5.8.3 | Type Safety |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 22.x | Runtime |
| Express | 5.2.1 | Web Framework |
| MongoDB | 7.0+ | Primary Database |
| Mongoose | 9.1.6 | ODM |
| Redis | 7.0+ | Cache & Sessions |
| Socket.io | 4.8.3 | WebSocket Server |
| JWT | 9.0.3 | Authentication |
| bcrypt | 6.0.0 | Password Hashing |
| Winston | 3.x | Logging |
| Helmet | 8.1.0 | Security Headers |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Container Orchestration |
| Nginx | Reverse Proxy / Load Balancer |
| PM2 | Process Management |
| Let's Encrypt | SSL Certificates |
| AWS S3 | File Storage (Optional) |

### Testing & Quality
| Technology | Purpose |
|------------|---------|
| Jest | Unit/Integration Testing |
| Supertest | API Testing |
| MongoDB Memory Server | Test Database |
| Cypress | E2E Testing (Frontend) |
| Artillery | Load Testing |

---

## Component Architecture

### Frontend Components

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── AuthLayout.tsx
│   ├── tasks/
│   │   ├── TaskBoard.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskModal.tsx
│   │   └── TaskFilters.tsx
│   ├── pullrequests/
│   │   ├── PRList.tsx
│   │   ├── PRDetail.tsx
│   │   └── PRModal.tsx
│   ├── chat/
│   │   ├── ChatRoom.tsx
│   │   ├── ChatSidebar.tsx
│   │   └── VideoCall.tsx
│   └── shared/
│       ├── FileUploader.tsx
│       ├── FilePreview.tsx
│       └── NotificationsBell.tsx
├── context/
│   ├── AuthContext.tsx
│   └── VideoContext.tsx
├── services/
│   ├── api.ts
│   ├── socket.ts
│   └── webrtc.ts
└── store/
    ├── authSlice.ts
    ├── projectSlice.ts
    └── taskSlice.ts
```

### Backend Structure

```
src/
├── controllers/      # Request handlers
│   ├── authController.js
│   ├── projectController.js
│   ├── taskController.js
│   ├── prController.js
│   └── fileController.js
├── models/          # Mongoose schemas
│   ├── User.js
│   ├── Project.js
│   ├── Task.js
│   ├── PullRequest.js
│   ├── Message.js
│   └── File.js
├── routes/          # API routes
│   ├── authRoutes.js
│   ├── projectRoutes.js
│   ├── taskRoutes.js
│   └── healthRoutes.js
├── middleware/      # Express middleware
│   ├── auth.js
│   ├── validation.js
│   ├── errorHandler.js
│   └── rateLimiter.js
├── services/        # Business logic
│   ├── notificationService.js
│   ├── fileAttachmentService.js
│   ├── taskService.js
│   └── emailService.js
├── socket/          # Socket.io handlers
│   ├── index.js
│   ├── chatHandlers.js
│   └── presenceHandlers.js
├── utils/           # Utilities
│   ├── logger.js
│   ├── validators.js
│   └── helpers.js
└── config/          # Configuration
    ├── database.js
    └── socket.js
```

---

## Data Flow

### Authentication Flow
```
1. User Registration
   Client → POST /api/auth/register
   → Validate input
   → Hash password (bcrypt)
   → Create user in MongoDB
   → Send verification email
   → Return JWT token

2. User Login
   Client → POST /api/auth/login
   → Validate credentials
   → Compare password hash
   → Generate JWT (access + refresh)
   → Store refresh token in HTTP-only cookie
   → Return tokens

3. Protected Request
   Client → GET /api/tasks (with JWT in Authorization header)
   → Verify JWT signature
   → Check expiration
   → Extract user ID
   → Attach req.user
   → Process request
```

### Real-Time Notification Flow
```
1. Event Trigger (e.g., task assigned)
   Controller → notificationService.notifyTaskAssigned()
   → Create notification in MongoDB
   → Emit Socket.io event to user's room
   → Send email (if user offline)
   → Return success

2. Client Receives Notification
   Socket.io event → Client listens on 'notification'
   → Update Redux store
   → Show toast/banner
   → Badge counter increment
```

### File Upload Flow
```
1. Client Uploads File
   Client → POST /api/files/upload (multipart/form-data)
   → Multer middleware processes upload
   → Validate file type & size
   → Upload to S3 or local storage
   → Create File document in MongoDB
   → Return file metadata

2. Link File to Resource
   Client → POST /api/tasks/:id/attach-file
   → fileAttachmentService.attachToTask()
   → Update file's attachedTo field
   → Notify watchers
   → Return success
```

---

## Database Schema

### Key Collections

#### Users
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique, indexed),
  password: String (hashed),
  avatar: String,
  isVerified: Boolean,
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Projects
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: ObjectId (ref: User, indexed),
  members: [{
    user: ObjectId (ref: User),
    role: String (enum: admin, developer, viewer),
    joinedAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

#### Tasks
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  projectId: ObjectId (ref: Project, indexed),
  columnId: ObjectId (ref: Column),
  status: String (enum: to_do, in_progress, review, done),
  priority: String (enum: low, medium, high, critical),
  assignees: [ObjectId] (ref: User, indexed),
  createdBy: ObjectId (ref: User),
  linkedPRs: [ObjectId] (ref: PullRequest),
  dueDate: Date,
  estimatedHours: Number,
  tags: [String],
  comments: [{
    author: ObjectId,
    text: String,
    createdAt: Date
  }],
  activity: [{
    type: String,
    user: ObjectId,
    description: String,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

#### PullRequests
```javascript
{
  _id: ObjectId,
  number: Number (auto-increment per project),
  title: String,
  description: String,
  projectId: ObjectId (ref: Project, indexed),
  author: ObjectId (ref: User),
  sourceBranch: String,
  targetBranch: String,
  status: String (enum: open, merged, closed),
  reviewers: [ObjectId] (ref: User),
  reviews: [{
    reviewer: ObjectId,
    status: String (enum: approved, changes_requested, commented),
    comment: String,
    reviewedAt: Date
  }],
  linkedTasks: [ObjectId] (ref: Task),
  mergedBy: ObjectId (ref: User),
  mergedAt: Date,
  hasConflicts: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
// Performance-critical indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.projects.createIndex({ owner: 1 })
db.tasks.createIndex({ projectId: 1, status: 1 })
db.tasks.createIndex({ assignees: 1 })
db.pullrequests.createIndex({ projectId: 1, status: 1 })
db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 })
db.messages.createIndex({ projectId: 1, createdAt: 1 })
```

---

## API Design

### RESTful Endpoints

#### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/forgot-password
PATCH  /api/auth/reset-password
POST   /api/auth/verify-email
GET    /api/auth/me
```

#### Projects
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
POST   /api/projects/:id/invite
GET    /api/projects/:id/members
```

#### Tasks
```
GET    /api/tasks                    # With filters
POST   /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/tasks/:id/comments
POST   /api/tasks/:id/attach-file
GET    /api/tasks/:projectId/analytics
```

#### Pull Requests
```
GET    /api/pull-requests
POST   /api/pull-requests
GET    /api/pull-requests/:id
PUT    /api/pull-requests/:id
POST   /api/pull-requests/:id/review
POST   /api/pull-requests/:id/merge
PUT    /api/pull-requests/:id/close
```

#### Health Checks
```
GET    /api/health                   # Basic health
GET    /api/health/detailed          # Detailed with dependencies
GET    /api/health/readiness         # Kubernetes ready probe
GET    /api/health/liveness          # Kubernetes live probe
```

### Response Format
```javascript
// Success
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}

// Error
{
  "success": false,
  "error": "Error description",
  "statusCode": 400
}

// Paginated
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## Real-Time Architecture

### Socket.io Events

#### Client → Server
```javascript
'join-room'          // Join project room
'leave-room'         // Leave project room
'send-message'       // Send chat message
'typing'             // User is typing
'presence-update'    // Update online status
'video-signal'       // WebRTC signaling
```

#### Server → Client
```javascript
'notification'       // New notification
'message'            // New chat message
'task-update'        // Task modified
'pr-update'          // PR status changed
'user-joined'        // User joined room
'user-left'          // User left room
'presence-update'    // User status changed
```

### WebRTC Architecture
```
Peer A                  Signaling Server (Socket.io)                Peer B
  │                               │                                    │
  ├───────  offer ───────────────>│                                    │
  │                               ├────── forward offer ──────────────>│
  │                               │<────── answer ─────────────────────┤
  │<──────  answer ────────────────┤                                    │
  │                               │                                    │
  │<═══════════════════ Direct P2P Connection ═══════════════════════>│
  │                    (audio/video stream)                            │
```

---

## Security Architecture

### Defense Layers

1. **Network Layer**
   - Firewall (ports 80, 443 only)
   - DDoS protection (Cloudflare)
   - VPC isolation for database

2. **Application Layer**
   - Rate limiting (express-rate-limit)
   - Input validation (express-validator)
   - SQL/NoSQL injection prevention
   - XSS protection (helmet, sanitize-html)

3. **Authentication Layer**
   - JWT with short expiration (15min)
   - Refresh tokens (HTTP-only cookies)
   - bcrypt with 12 salt rounds
   - Email verification

4. **Authorization Layer**
   - Role-based access control (RBAC)
   - Project membership checks
   - Resource ownership verification

5. **Data Layer**
   - Encryption at rest (MongoDB)
   - Encrypted connections (TLS)
   - Sensitive data redaction in logs
   - Regular backups

---

## Deployment Architecture

### Production Setup (Docker)
```
[Load Balancer (Nginx)]
        │
        ├─── [Backend Container 1] ─┐
        ├─── [Backend Container 2] ─┤
        └─── [Frontend Container]   │
                                     ↓
                        [MongoDB Replica Set]
                        [Redis Cluster]
```

### Scaling Considerations
- **Horizontal Scaling**: PM2 cluster mode or Docker replicas
- **Database Scaling**: MongoDB replica set + read replicas
- **Cache Layer**: Redis for session store and caching
- **CDN**: CloudFront for static assets
- **File Storage**: S3 for user uploads

---

## Monitoring & Observability

### Metrics to Track
- **Application**: Response time, error rate, throughput
- **Database**: Query performance, connection pool
- **System**: CPU, memory, disk usage
- **Business**: User signups, active projects, tasks created

### Tools
- **Logging**: Winston (structured JSON logs)
- **Error Tracking**: Sentry
- **Application Monitoring**: PM2 Plus or New Relic
- **Uptime Monitoring**: UptimeRobot or Pingdom

---

**Document Owner:** Engineering Team  
**Review Cycle:** Quarterly  
**Next Review:** May 13, 2026
