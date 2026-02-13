# Production Hardening Implementation Guide
## Final Steps to Production Readiness

**Status:** READY FOR IMPLEMENTATION  
**Estimated Time:** 4-6 hours  
**Prerequisites:** All code changes committed to repository

---

## Overview

This guide completes the final production hardening tasks. All code changes are implemented; this guide covers installation, configuration, testing, and deployment validation.

---

## Phase 1: Install Dependencies & Update Configuration (30 minutes)

### 1.1 Install New Dependencies

```bash
cd server

# Install Sentry for error tracking
npm install @sentry/node@^8.0.0 @sentry/profiling-node@^8.0.0

# Install Pino pretty printer for development
npm install pino-pretty@^13.0.0

# Verify installation
npm list @sentry/node pino-pretty

# Fix any vulnerabilities
npm audit fix
```

### 1.2 Create Required Directories

```bash
# Backend
mkdir -p server/logs
mkdir -p server/mongodb-binaries
mkdir -p server/load-testing/results

# Ensure upload directories exist
mkdir -p server/uploads/{avatars,files,tasks,temp}

# Set permissions (Linux/Mac)
chmod -R 755 server/uploads
chmod -R 755 server/logs
```

### 1.3 Update Environment Variables

Edit `server/.env` and add/update:

```bash
# Logging
LOG_LEVEL=info
LOG_TESTS=false

# Redis (required)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Sentry (required for production)
SENTRY_DSN=https://your-sentry-project@sentry.io/project-id
SENTRY_RELEASE=1.0.0

# MongoDB Memory Server (for tests)
MONGOMS_VERSION=7.0.14
MONGOMS_DOWNLOAD_TIMEOUT=300000
MONGOMS_DISABLE_POSTINSTALL=1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120

# Ensure these are secure
JWT_SECRET=<generate-with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate-with: openssl rand -hex 32>
```

### 1.4 Verify Configuration

```bash
# Test environment loading
node -e "require('dotenv').config(); console.log('NODE_ENV:', process.env.NODE_ENV); console.log('REDIS_URL:', process.env.REDIS_URL)"
```

---

## Phase 2: Run Tests & Fix Issues (1-2 hours)

### 2.1 Fix Test Execution

```bash
cd server

# Set test environment
export NODE_ENV=test  # Linux/Mac
# OR
$env:NODE_ENV="test"  # Windows PowerShell

# Run tests
npm test

# If MongoDB download fails, use local MongoDB:
# 1. Start local MongoDB: mongod
# 2. Update tests/setup.js to use local connection instead of MongoMemoryServer
```

### 2.2 Generate Coverage Report

```bash
npm run test:coverage

# View coverage report
# Open: server/coverage/lcov-report/index.html
```

### 2.3 Target: 80% Coverage

**If coverage < 80%, add tests for:**
- Controller functions
- Service methods
- Middleware functions
- Error handlers

---

## Phase 3: Redis Setup & Integration (30 minutes)

### 3.1 Install Redis

**Option A: Docker (Recommended)**
```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your-redis-password
```

**Option B: Native Installation**
```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# macOS
brew install redis
brew services start redis

# Windows
# Download from: https://github.com/microsoftarchive/redis/releases
```

### 3.2 Test Redis Connection

```bash
# Without password
redis-cli ping
# Should return: PONG

# With password
redis-cli -a your-redis-password ping
```

### 3.3 Verify Redis Integration

```bash
# Start server
npm start

# Check health endpoint
curl http://localhost:5000/api/health/detailed

# Verify Redis status in response
# Should show: "redis": { "status": "up", ... }
```

---

## Phase 4: Monitoring Setup (1 hour)

### 4.1 Sentry Configuration

1. **Create Sentry Account**
   - Visit: https://sentry.io
   - Create new project (Node.js)
   - Copy DSN

2. **Add to Environment**
   ```bash
   SENTRY_DSN=https://your-key@sentry.io/project-id
   ```

3. **Test Sentry**
   ```bash
   # Start server with Sentry enabled
   npm start
   
   # Trigger test error (create this endpoint in development)
   # Sentry will capture and report it
   ```

### 4.2 Uptime Monitoring

1. **Sign up for UptimeRobot** (free)
   - URL: https://uptimerobot.com

2. **Add Monitors:**
   - HTTP Monitor: `https://yourapp.com/api/health` (every 5 minutes)
   - Keyword Monitor: Look for `"status":"ok"`

3. **Configure Alerts:**
   - Email notifications (immediate)
   - Webhook to Slack (optional)

### 4.3 Log Rotation (Linux/Mac)

```bash
# Create logrotate config
sudo nano /etc/logrotate.d/devplatform

# Paste configuration (see MONITORING_SETUP.md)
# Then test:
sudo logrotate -d /etc/logrotate.d/devplatform
```

---

## Phase 5: Load Testing & Optimization (1-2 hours)

### 5.1 Install Artillery

```bash
npm install -g artillery@latest

# Verify installation
artillery version
```

### 5.2 Prepare Load Test Data

Edit `server/load-testing/test-data.csv` with real test user emails/passwords.

### 5.3 Run Load Tests

```bash
cd server

# Basic load test
npm run test:load

# With detailed report
npm run test:load:report

# View results
cat load-testing/results/report.json
```

### 5.4 Analyze Results

**Target Metrics:**
- **p95 response time:** < 1 second
- **p99 response time:** < 2 seconds
- **Error rate:** < 1%
- **Throughput:** > 50 req/second

**If targets not met:**
1. Check database indexes (see Phase 6)
2. Enable Redis caching
3. Optimize slow queries
4. Consider connection pool tuning

---

## Phase 6: Database Optimization (30 minutes)

### 6.1 Create MongoDB Indexes

```bash
# Connect to MongoDB
mongosh "your-mongodb-uri"

# Switch to database
use devplatform

# Create indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.projects.createIndex({ owner: 1 })
db.tasks.createIndex({ projectId: 1, status: 1 })
db.tasks.createIndex({ assignees: 1 })
db.pullrequests.createIndex({ projectId: 1, status: 1 })
db.notifications.createIndex({ userId: 1, read: 1, createdAt: -1 })
db.messages.createIndex({ projectId: 1, createdAt: 1 })
db.files.createIndex({ "attachedTo.resource": 1, "attachedTo.resourceId": 1 })

# Verify indexes
db.tasks.getIndexes()
```

### 6.2 Enable Query Profiling

```javascript
// In mongosh
db.setProfilingLevel(1, { slowms: 100 });

// Check slow queries after load testing
db.system.profile.find().sort({ ts: -1 }).limit(10).pretty();
```

---

## Phase 7: WebRTC TURN Server (Optional, 1 hour)

### 7.1 Install Coturn (Linux Server)

```bash
# Ubuntu/Debian
sudo apt-get install coturn

# Enable service
sudo systemctl enable coturn
```

### 7.2 Configure Coturn

```bash
# Copy configuration file
sudo cp /path/to/turnserver.conf /etc/turnserver.conf

# Update with your values:
# - external-ip (your server's public IP)
# - realm (your domain)
# - user credentials
# - SSL certificates

# Start service
sudo systemctl start coturn
sudo systemctl status coturn
```

### 7.3 Update Frontend WebRTC Config

Edit `client/src/services/webrtc.ts`:

```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:turn.yourplatform.com:3478',
    username: 'turnuser',
    credential: 'turnpass123'
  }
];
```

### 7.4 Test TURN Server

```bash
# Install turnutils
sudo apt-get install coturn

# Test TURN connectivity
turnutils_uclient -v -u turnuser -w turnpass123 your-server-ip
```

---

## Phase 8: Backup Automation (30 minutes)

### 8.1 Make Scripts Executable

```bash
chmod +x server/scripts/backup-mongodb.sh
chmod +x server/scripts/restore-mongodb.sh
```

### 8.2 Configure Backup Script

Edit `server/scripts/backup-mongodb.sh`:
- Set `BACKUP_DIR`
- Set `MONGO_URI`
- Set `MONGO_DB`
- Set `RETENTION_DAYS`
- (Optional) Set `S3_BUCKET` for cloud backups

### 8.3 Test Backup

```bash
# Manual backup
./server/scripts/backup-mongodb.sh

# Verify backup created
ls -lh /var/backups/mongodb/
```

### 8.4 Schedule Daily Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/server/scripts/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

### 8.5 Test Restore (IMPORTANT!)

```bash
# Use a test database to verify restore works
MONGO_DB=devplatform_test ./server/scripts/restore-mongodb.sh /path/to/backup.tar.gz
```

---

## Phase 9: Security Hardening (30 minutes)

### 9.1 Security Checklist

Run through `SECURITY_AUDIT.md` and verify:

- [ ] JWT secrets are strong (>= 32 characters)
- [ ] HTTPS enforced (in production)
- [ ] CORS configured for production domains only
- [ ] Rate limiting active
- [ ] File upload validation working
- [ ] Helmet security headers enabled
- [ ] No default passwords in use
- [ ] MongoDB authentication enabled
- [ ] Redis password set
- [ ] Environment variables not committed

### 9.2 Update Production CORS

Edit `server/src/app.js`:

```javascript
cors({
  origin: [
    "https://yourapp.com",
    "https://www.yourapp.com",
    // Remove localhost origins in production
  ],
  credentials: true,
})
```

### 9.3 Enable HTTPS Redirect (Nginx)

```nginx
# In nginx.conf
server {
    listen 80;
    server_name yourapp.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Phase 10: Deployment Validation (1 hour)

### 10.1 Run Validation Script

```bash
# Make script executable
chmod +x scripts/validate-deployment.sh

# Run validation
./scripts/validate-deployment.sh

# Should show 80%+ pass rate
```

### 10.2 Manual Smoke Tests

**Test Flow:**
1. Register new user → Verify email → Login
2. Create project → Invite team member
3. Create task → Assign → Update status
4. Create pull request → Link to task → Merge
5. Upload file → Attach to task
6. Send chat message → Verify real-time delivery
7. Start video call → Verify connection

### 10.3 Docker Deployment Test

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f

# Test health
curl http://localhost:5000/api/health/detailed

# Stop
docker-compose down
```

---

## Phase 11: Production Deployment

### 11.1 Choose Deployment Method

**Option A: Docker (Recommended)**
- Follow steps in `DEPLOYMENT_GUIDE.md` → Docker Deployment
- Use provided `docker-compose.yml`
- Configure SSL with Let's Encrypt

**Option B: Manual Deployment**
- Follow steps in `DEPLOYMENT_GUIDE.md` → Manual Deployment
- Install Node.js, MongoDB, Redis, Nginx, PM2
- Use provided `ecosystem.config.js` for PM2

### 11.2 Pre-Deployment Checklist

- [ ] All tests pass (npm test)
- [ ] Load tests meet performance targets
- [ ] Security audit completed
- [ ] Backups configured and tested
- [ ] Monitoring setup (Sentry + UptimeRobot)
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Firewall rules set

### 11.3 Deploy to Staging First

- Deploy to staging environment
- Run smoke tests
- Monitor for 24-48 hours
- Fix any issues before production

### 11.4 Production Deployment

```bash
# Pull latest code
git pull origin main

# Install dependencies
cd server && npm ci
cd ../client && npm ci

# Build frontend
cd client
npm run build

# Deploy backend (PM2)
cd ../server
pm2 start ecosystem.config.js --env production

# Or deploy with Docker
docker-compose -f docker-compose.yml up -d --build
```

### 11.5 Post-Deployment Verification

```bash
# Check health
curl https://yourapp.com/api/health/detailed

# Monitor logs
pm2 logs

# Or for Docker
docker-compose logs -f

# Watch Sentry dashboard for errors
# Check UptimeRobot status
```

---

## Phase 12: Post-Launch Monitoring (First 48 Hours)

### 12.1 Critical Monitoring

**Check every 2-4 hours:**
- Error rate in Sentry
- Response times
- Database performance
- Server CPU/memory usage
- User feedback/support tickets

### 12.2 Performance Baseline

**Record metrics:**
- Average response time
- Peak concurrent users
- Database query performance
- Cache hit rate
- Error rate

### 12.3 Be Ready to Rollback

Keep previous version available:
```bash
# Tag deployments
git tag v1.0.0
git push --tags

# Quick rollback with PM2
pm2 deploy production revert 1

# Or with Docker
docker-compose down
docker-compose -f docker-compose.yml.backup up -d
```

---

## Troubleshooting Common Issues

### Tests Failing

**MongoDB Memory Server timeout:**
- Increase timeout in `jest.config.js`
- Or use local MongoDB:
  ```javascript
  // In tests/setup.js
  const mongoUri = "mongodb://localhost:27017/test-db";
  await mongoose.connect(mongoUri);
  ```

**Redis connection failed:**
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL in .env
- Tests continue without Redis (non-blocking)

### Server Won't Start

**Port already in use:**
```bash
# Find process using port 5000
lsof -i :5000  # Mac/Linux
netstat -ano | findstr :5000  # Windows

# Kill process or use different port
PORT=5001 npm start
```

**MongoDB connection failed:**
- Verify MongoDB is running
- Check MONGO_URI in .env
- Test connection: `mongosh "your-uri"`

### High Error Rate After Deployment

1. Check Sentry for error patterns
2. Review recent code changes
3. Check database indexes
4. Verify environment variables
5. Check network/firewall rules
6. Rollback if necessary

### Slow Performance

1. Enable Redis caching
2. Check database indexes
3. Review slow query log
4. Increase server resources
5. Enable CDN for static assets
6. Optimize heavy API endpoints

---

## Success Criteria

✅ **Tests**
- All tests pass
- Coverage >= 80%
- Load tests meet SLA

✅ **Security**
- No high/critical vulnerabilities
- Secure secrets configured
- HTTPS enabled

✅ **Monitoring**
- Sentry capturing errors
- Uptime monitoring active
- Logs rotating properly

✅ **Performance**
- p95 response time < 1s
- Error rate < 1%
- Uptime > 99.9%

✅ **Backups**
- Daily backups running
- Restore tested successfully

✅ **Documentation**
- Runbook complete
- Team trained
- On-call rotation set

---

## Next Steps

### Week 1
- Monitor closely
- Fix any critical issues
- Gather user feedback

### Week 2
- Optimize based on metrics
- Add missing tests
- Update documentation

### Month 1
- Review performance trends
- Plan scaling strategy
- Schedule security audit

---

**Completion Estimate:** 4-6 hours active work + 24-48 hours monitoring

**Critical Path:**
1. Install dependencies (30 min)
2. Fix tests (1-2 hours)
3. Configure Redis (30 min)
4. Set up monitoring (1 hour)
5. Run validation (1 hour)
6. Deploy (varies)

**Support:** Check logs, Sentry, and health endpoints if issues arise.

---

**Last Updated:** February 13, 2026  
**Version:** 1.0.0
