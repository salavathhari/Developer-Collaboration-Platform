# Pre-Launch Validation Guide

Complete validation testing framework for ensuring production readiness before public launch.

## Table of Contents

1. [Overview](#overview)
2. [Validation Scripts](#validation-scripts)
3. [Quick Start](#quick-start)
4. [Individual Tests](#individual-tests)
5. [Configuration](#configuration)
6. [Interpreting Results](#interpreting-results)
7. [Troubleshooting](#troubleshooting)

## Overview

The pre-launch validation suite consists of 7 comprehensive test phases:

| Phase | Test Name | Purpose | Duration |
|-------|-----------|---------|----------|
| 1 | Staging Deployment Validation | Verify infrastructure connectivity | ~5 min |
| 2 | User Acceptance Testing (UAT) | Validate end-user workflows | ~10 min |
| 3 | Load Testing | Assess performance under load | ~15 min |
| 4 | Monitoring Validation | Verify observability infrastructure | ~5 min |
| 5 | Security Penetration Testing | Identify vulnerabilities | ~10 min |
| 6 | Backup & Restore Validation | Test disaster recovery | ~10 min |
| 7 | Final Launch Checklist | Comprehensive pre-launch audit | ~5 min |

**Total estimated time:** ~60 minutes

## Validation Scripts

All scripts are located in [`scripts/`](../scripts/) directory:

```
scripts/
├── run-all-validations.sh          # Master orchestration script
├── staging-validation.sh            # Phase 1: Infrastructure
├── uat-testing.sh                   # Phase 2: User workflows
├── load-test-execution.sh           # Phase 3: Performance
├── monitoring-validation.sh         # Phase 4: Observability
├── security-penetration-test.sh     # Phase 5: Security
├── backup-restore-validation.sh     # Phase 6: Disaster recovery
└── final-launch-checklist.sh        # Phase 7: Launch readiness
```

## Quick Start

### Run All Validations (Recommended)

Execute the complete validation suite:

```bash
# From project root
bash scripts/run-all-validations.sh
```

This will:
- Run all 7 validation phases sequentially
- Generate comprehensive reports
- Provide a final go/no-go launch decision

### Prerequisites

Before running validations:

```bash
# 1. Start the API server
cd server
npm install
npm start

# 2. Verify server is running
curl http://localhost:5000/api/health

# 3. Install Artillery (for load testing)
npm install -g artillery

# 4. Ensure MongoDB is accessible
# For backup validation
```

## Individual Tests

### Phase 1: Staging Deployment Validation

Tests infrastructure components and connectivity.

```bash
bash scripts/staging-validation.sh
```

**Tests:**
- API server health
- Redis connectivity (with direct SET/GET operations)
- MongoDB connectivity (with db.stats() and index checks)
- Socket.io WebSocket endpoints
- Authentication flow (register, login, token refresh, rate limiting)
- File upload system
- Email delivery (SMTP connectivity)
- TURN server (UDP/TCP ports for WebRTC)
- Performance baseline (<1s response time target)
- Security headers (X-Content-Type-Options, HSTS, CSP)
- Environment configuration
- Documentation completeness

**Pass Criteria:**
- ≥90% tests pass with 0 failures → **READY FOR PRODUCTION**
- ≥80% tests pass with 0 failures → **REVIEW WARNINGS**
- <80% or any failures → **NEEDS FIXES**

**Output:**
- `validation-results-YYYYMMDD_HHMMSS/` directory with:
  - `summary.txt` - Final pass/fail/warning counts
  - `health-check.json` - Full health response
  - `auth-*.json` - Authentication test responses
  - `response-times.txt` - Performance metrics

### Phase 2: User Acceptance Testing (UAT)

Simulates real user journeys end-to-end.

```bash
bash scripts/uat-testing.sh
```

**User Journeys:**
1. **Registration & Login** - Signup → Verify → Login
2. **Project Creation** - Create project → Invite member
3. **Task Management** - Create → Assign → Update → Comment
4. **Pull Request Workflow** - Create PR → Link task → Review
5. **File Attachments** - Upload → Attach to task
6. **Notifications** - Verify notification delivery
7. **Analytics** - Fetch project insights

**Pass Criteria:**
- ≥90% success rate, 0 failures → **USER EXPERIENCE SMOOTH**
- ≥80% success rate → **ADDRESS FRICTION POINTS**
- <80% success rate → **SIGNIFICANT UX ISSUES**

**Friction Points Tracked:**
- Operations taking >5 seconds
- Failed API calls
- Unclear error messages
- Broken workflows

**Output:**
- `uat-results-YYYYMMDD_HHMMSS/uat-report.md` - Detailed user journey report
- All API responses saved as JSON

### Phase 3: Load Testing & Performance

Stress tests the system with concurrent users.

```bash
bash scripts/load-test-execution.sh
```

**Load Profile:**
- **Warm-up:** 30s @ 5 users/sec
- **Ramp-up:** 60s @ 10→25 users/sec
- **Sustained Load:** 120s @ 25 users/sec
- **Spike:** 30s @ 50 users/sec
- **Cool-down:** 30s @ 10 users/sec

**Scenarios (Realistic Distribution):**
- 30% - Authentication flows
- 40% - Task operations
- 20% - Pull request workflows
- 10% - Chat & notifications

**Performance Targets:**
- **p50 (median):** <500ms ✅
- **p95:** <1000ms ✅
- **p99:** <2000ms ✅
- **Error rate:** <1% ✅

**Output:**
- `load-test-results-YYYYMMDD_HHMMSS/`
  - `performance-report.md` - Detailed analysis with bottleneck identification
  - `artillery-report.html` - Interactive HTML report
  - `artillery-report.json` - Raw metrics
  - `baseline-metrics.txt` - Pre/post-test memory usage

### Phase 4: Monitoring Validation

Verifies observability infrastructure.

```bash
bash scripts/monitoring-validation.sh
```

**Tests:**
1. **Health Check Endpoints**
   - Basic health: `/api/health`
   - Detailed health: `/api/health/detailed` (MongoDB, Redis, Socket.io status)
   - Readiness probe: `/api/health/ready`
   - Liveness probe: `/api/health/live`

2. **Sentry Error Tracking**
   - DSN configuration
   - Environment setup
   - Error capture (if test endpoint available)

3. **Logging System**
   - Log directory exists
   - Log files being written
   - Log rotation active
   - Pino logger configured
   - Sensitive data redaction

4. **Failure Scenarios**
   - Redis unavailable (graceful degradation test)
   - Slow database queries (concurrent load test)

5. **Alerting Configuration**
   - Email/Slack webhooks
   - Sentry alerts

**Output:**
- `monitoring-validation-YYYYMMDD_HHMMSS/monitoring-report.md`
- Health check responses
- Log samples

### Phase 5: Security Penetration Testing

OWASP Top 10 focused security assessment.

```bash
bash scripts/security-penetration-test.sh
```

**Security Tests:**

1. **Authentication Brute Force**
   - 10 failed login attempts
   - Rate limiting verification (should trigger HTTP 429)

2. **NoSQL Injection**
   - MongoDB operator injection (`$ne`, `$gt`, `$regex`)
   - Query sanitization validation

3. **XSS (Cross-Site Scripting)**
   - `<script>alert()</script>`
   - `<img src=x onerror=alert()>`
   - Output escaping validation

4. **File Upload Security**
   - Dangerous file types (.php, .exe, .sh)
   - File size limits (20MB test)
   - Double extensions (.jpg.exe)

5. **JWT Token Security**
   - Tampered token rejection
   - Expired token validation
   - `alg: "none"` attack prevention

6. **Session Security**
   - Session fixation testing
   - Session regeneration after auth

7. **Security Headers**
   - X-Content-Type-Options
   - X-Frame-Options
   - HSTS (Strict-Transport-Security)
   - Content-Security-Policy

8. **Authentication Bypass**
   - Protected endpoints without auth

**Risk Assessment:**
- **0 vulnerabilities** → LOW RISK (GO)
- **1-2 vulnerabilities** → MEDIUM RISK (REVIEW)
- **3+ vulnerabilities** → HIGH RISK (NO-GO)

**Output:**
- `security-test-YYYYMMDD_HHMMSS/security-report.md`
- `vulnerabilities.txt` - Critical issues to fix
- Test payloads and responses

### Phase 6: Backup & Restore Validation

Tests disaster recovery capabilities.

```bash
bash scripts/backup-restore-validation.sh
```

**Test Workflow:**
1. Create test data in MongoDB
2. Execute backup script
3. Verify backup file created
4. Simulate data loss (drop collection)
5. Restore from backup
6. Verify data integrity

**Validation:**
- Backup creation successful
- Backup file size reasonable
- Restore completes without errors
- Data matches exactly after restore

**Recovery Time Objective (RTO):**
- Target: <1 hour
- Measured: Backup time + Restore time

**Output:**
- `backup-validation-YYYYMMDD_HHMMSS/backup-validation-report.md`
- Backup/restore duration
- Data integrity verification

### Phase 7: Final Launch Checklist

Comprehensive production readiness audit.

```bash
bash scripts/final-launch-checklist.sh
```

**10 Categories Audited:**

1. **SSL/TLS & HTTPS**
   - HTTPS enabled
   - Valid SSL certificate
   - Certificate expiry date
   - HSTS header

2. **Secrets Management**
   - `.env` file exists
   - JWT_SECRET strength (>32 chars)
   - MongoDB URI configured
   - Redis configured
   - Sentry DSN
   - SMTP settings
   - `.env` in `.gitignore`

3. **Database Configuration**
   - Connection successful
   - Indexes defined
   - Backup scripts exist
   - Automated backups scheduled

4. **Monitoring & Observability**
   - Health endpoints operational
   - Pino logger configured
   - Sentry integrated
   - Log rotation active

5. **CI/CD Pipeline**
   - GitHub Actions workflows
   - Docker configurations
   - Deployment scripts

6. **Security Hardening**
   - 0 npm vulnerabilities (run `npm audit`)
   - Rate limiting enabled
   - Helmet security headers
   - CORS properly configured (not `*`)

7. **Performance & Scalability**
   - Redis caching
   - PM2 process manager
   - Response compression

8. **Documentation**
   - README.md
   - DEPLOYMENT_GUIDE.md
   - API documentation

9. **Test Coverage**
   - Backend tests passing
   - Frontend tests configured

10. **Final Validations**
    - Staging validation complete
    - UAT complete
    - Load testing complete
    - Security testing complete

**Launch Decision Matrix:**
- **≥85% ready + 0 blockers** → ✅ **GO FOR LAUNCH**
- **≥80% ready + 0 blockers** → ⚠️ **CONDITIONAL GO** (review warnings)
- **<80% or blockers exist** → ❌ **NO-GO FOR LAUNCH**

**Output:**
- `launch-checklist-YYYYMMDD_HHMMSS/launch-readiness-report.md`
- Categorized checklist results
- Blocker/warning/ready counts
- Pre-launch TODO list

## Configuration

### Environment Variables

Set these before running validations:

```bash
# API Configuration
export API_URL="http://localhost:5000"           # Local testing
export STAGING_URL="https://staging.example.com" # Staging environment
export PRODUCTION_URL="https://app.example.com"  # Production URL

# Test User Credentials
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="Test@123"
export TEST_PROJECT_ID="your-project-id"         # For load testing

# Database
export MONGO_URI="mongodb://localhost:27017"
export DB_NAME="developerplatform"

# Redis
export REDIS_URL="redis://localhost:6379"

# Monitoring
export SENTRY_DSN="https://your-sentry-dsn"
export LOG_DIR="./server/logs"

# SMTP
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"

# TURN Server
export TURN_SERVER="turn:your-turn-server.com:3478"
```

### Selective Test Execution

Run specific phases only:

```bash
# Disable certain tests
export RUN_STAGING=true
export RUN_UAT=true
export RUN_LOAD=false        # Skip load testing
export RUN_MONITORING=true
export RUN_SECURITY=true
export RUN_BACKUP=false      # Skip backup testing
export RUN_CHECKLIST=true

bash scripts/run-all-validations.sh
```

## Interpreting Results

### Result Directories

Each validation creates a timestamped directory:

```
pre-launch-validation-20240115_143022/
├── VALIDATION_REPORT.md                      # Master report
├── summary.txt                                # Quick summary
├── phase1-Staging-Deployment-Validation.log
├── phase2-User-Acceptance-Testing.log
├── phase3-Load-Testing.log
├── phase4-Monitoring-Validation.log
├── phase5-Security-Penetration-Testing.log
├── phase6-Backup-Restore-Validation.log
├── phase7-Final-Launch-Checklist.log
└── [individual test reports copied here]
```

### Exit Codes

- **0** - All tests passed or acceptable results
- **1** - Critical failures detected

### Severity Levels

| Symbol | Meaning | Action Required |
|--------|---------|-----------------|
| ✓ / ✅ | Pass / Ready | None - proceed |
| ⚠️ | Warning | Review, but not blocking |
| ✗ / ❌ | Fail / Blocker | Must fix before launch |

## Troubleshooting

### Common Issues

#### 1. "API server not reachable"

**Solution:**
```bash
cd server
npm start
# Verify: curl http://localhost:5000/api/health
```

#### 2. "Artillery not installed"

**Solution:**
```bash
npm install -g artillery
artillery --version
```

#### 3. "MongoDB client not found"

**Solution:**
```bash
# Install MongoDB Shell
# macOS
brew install mongosh

# Ubuntu
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
sudo apt-get install -y mongodb-mongosh

# Windows
choco install mongodb-shell
```

#### 4. "Rate limiting test fails"

**Check:**
- Rate limiting middleware enabled in `server/src/app.js`
- `express-rate-limit` package installed
- Limit configured (e.g., 5 attempts per 15 minutes)

#### 5. "Load test timeouts"

**Adjust:**
```bash
# Increase Artillery timeout
# Edit: server/load-testing/artillery-production.yml
config:
  timeout: 30  # Increase from default
```

#### 6. "Security test shows vulnerabilities"

**Fix by severity:**
- **CRITICAL (blockers):** Must fix before launch
  - Missing rate limiting
  - NoSQL injection
  - JWT 'none' algorithm accepted
  
- **HIGH (warnings):** Fix soon
  - XSS vulnerabilities
  - Weak security headers
  
- **MEDIUM (info):** Post-launch
  - Missing HSTS (needs HTTPS)
  - Missing CSP

### Log Analysis

#### Find all errors in logs:
```bash
grep -r "FAIL\|ERROR\|BLOCKER" pre-launch-validation-*/
```

#### Check specific phase:
```bash
cat pre-launch-validation-*/phase5-Security-Penetration-Testing.log
```

#### View summary only:
```bash
cat pre-launch-validation-*/VALIDATION_REPORT.md
```

## Best Practices

### Pre-Launch Validation Cadence

1. **Development:** Run staging validation + UAT weekly
2. **Pre-Staging:** Full suite before deploying to staging
3. **Pre-Production:** Full suite + manual review before production
4. **Post-Deployment:** Health checks + monitoring validation

### Continuous Validation

Add to CI/CD pipeline:

```yaml
# .github/workflows/pre-launch-validation.yml
name: Pre-Launch Validation

on:
  push:
    branches: [main, staging]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Run validation suite
        run: |
          export RUN_LOAD=false  # Skip in CI
          export RUN_BACKUP=false
          bash scripts/run-all-validations.sh
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: validation-results
          path: pre-launch-validation-*/
```

## Next Steps

After successful validation:

1. ✅ Review `VALIDATION_REPORT.md`
2. ✅ Address any warnings
3. ✅ Deploy to staging
4. ✅ Repeat validation on staging
5. ✅ Deploy to production
6. ✅ Monitor first 24 hours closely

## Support

For issues with validation scripts:
1. Check logs in results directory
2. Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. Run individual phases for detailed output
4. Verify environment variables set correctly

---

**Remember:** These validations catch issues *before* users do. Take the time to run them thoroughly and address all blockers before public launch.
