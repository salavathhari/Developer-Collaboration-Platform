# 🚀 Quick Start Guide - Team Collaboration Features

## Prerequisites
- Node.js 16+ and npm/yarn
- MongoDB running (local or Atlas)
- Redis (optional, for scaling)

## Setup (5 minutes)

### 1. Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Environment Configuration

Create `server/.env`:
```env
JWT_SECRET=your_secret_key_here
MONGODB_URI=mongodb://localhost:27017/devcollab
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### 3. Start Services

```bash
# Terminal 1: Start MongoDB (if local)
mongod

# Terminal 2: Start Backend
cd server
npm run dev

# Terminal 3: Start Frontend
cd client
npm run dev
```

## Using the Features

### 💬 Real-Time Chat

1. Navigate to any project workspace
2. Chat sidebar appears on the right
3. Type messages, use `@username` for mentions
4. Click reply icon to thread conversations

**Component**: [ChatSidebar.tsx](./client/src/components/ChatSidebar.tsx)

```tsx
// Usage in ProjectWorkspace.tsx
import ChatSidebar from '../components/ChatSidebar';

<ChatSidebar 
  projectId={projectId}
  roomType="project"
  roomId="main"
  currentUserId={user.id}
/>
```

### 📝 Inline PR Comments

1. Open any pull request
2. Hover over code lines in diff view
3. Click comment icon to add inline comment
4. Reply to create threaded discussions
5. Mark as resolved when done

**Component**: [InlineComment.tsx](./client/src/components/InlineComment.tsx)

```tsx
// Usage in PRDiffViewer
import InlineComment from '../components/InlineComment';

<InlineComment
  prId={prId}
  projectId={projectId}
  filePath="src/utils/helper.ts"
  lineNumber={42}
  currentUserId={user.id}
  existingComments={commentsAtLine}
/>
```

### 🐛 Quick Issue Creation

1. Click "Create Issue" button (add to your UI)
2. Or use keyboard shortcut: `Ctrl/Cmd + I`
3. Fill title, description, priority
4. Issue is automatically linked to current context

**Component**: [QuickIssueModal.tsx](./client/src/components/QuickIssueModal.tsx)

```tsx
import QuickIssueModal from '../components/QuickIssueModal';

const [issueModalOpen, setIssueModalOpen] = useState(false);

<QuickIssueModal
  projectId={projectId}
  isOpen={issueModalOpen}
  onClose={() => setIssueModalOpen(false)}
  context={{
    prId: currentPR?.id,
    filePath: currentFile,
    lineNumber: selectedLine
  }}
/>
```

### 👥 Presence Tracking

Enhanced presence bar shows who's online and what they're working on.

**Component**: [PresenceBar.tsx](./client/src/components/PresenceBar.tsx)

```tsx
import PresenceBar from '../components/PresenceBar';

<PresenceBar
  members={project.members}
  onlineUserIds={onlineUsers}
  projectId={projectId}
  currentUserId={user.id}
  enhanced={true}
  onUserClick={(userId, file, line) => {
    // Jump to user's location
    navigateToFile(file, line);
  }}
/>
```

## Testing

### Quick API Test

```bash
# Get auth token first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpass"}'
  
# Copy the token, then:
export TOKEN="paste_token_here"

# Test chat
curl http://localhost:5000/api/chat/history?projectId=YOUR_PROJECT_ID&roomType=project&roomId=main \
  -H "Authorization: Bearer $TOKEN"
```

### Socket.io Test

Open browser console on your app:

```javascript
// Connect to socket
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});

// Join chat room
socket.emit('chat:join_room', {
  projectId: 'YOUR_PROJECT_ID',
  roomType: 'project',
  roomId: 'main'
});

// Listen for messages
socket.on('chat:new_message', (msg) => {
  console.log('New message:', msg);
});

// Send a message
socket.emit('chat:send_message', {
  projectId: 'YOUR_PROJECT_ID',
  roomType: 'project',
  roomId: 'main',
  text: 'Hello from socket!'
});
```

## Troubleshooting

### Issue: Socket not connecting
**Solution**: Check CORS settings in [server/src/app.js](./server/src/app.js)

### Issue: Messages not persisting
**Solution**: Verify MongoDB connection in [server/src/config/db.js](./server/src/config/db.js)

### Issue: Mentions not working
**Solution**: Ensure user is a project member (check Project model members array)

### Issue: Presence not updating
**Solution**: Check that heartbeat is being sent every 30 seconds

## Database Setup

Run these commands in MongoDB shell to create indexes:

```javascript
use devcollab;

// Chat indexes
db.chat_messages.createIndex({ projectId: 1, roomType: 1, roomId: 1, createdAt: -1 });

// Comment indexes
db.review_comments.createIndex({ pullRequestId: 1, createdAt: 1 });

// Issue indexes
db.issues.createIndex({ project: 1, status: 1 });

// Presence indexes with TTL
db.presences.createIndex({ projectId: 1, userId: 1 }, { unique: true });
db.presences.createIndex({ lastActivity: 1 }, { expireAfterSeconds: 300 });
```

## Next Steps

1. ✅ Test each feature manually
2. ✅ Integration with existing project pages
3. ✅ Add keyboard shortcuts
4. ✅ Customize notification preferences
5. ✅ Add analytics tracking

## Full Documentation

See [COLLABORATION_FEATURES.md](./COLLABORATION_FEATURES.md) for:
- Complete API reference
- All socket events
- Acceptance criteria checklist
- Production deployment guide
- Performance optimizations

## Need Help?

- Check the main documentation
- Review the code comments
- Test with the provided curl commands
- Use browser DevTools Network/Console tabs

**Enjoy collaborating! 🎉**
