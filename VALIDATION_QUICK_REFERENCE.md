# 🚀 Pre-Launch Validation - Quick Reference

## ⚡ Quick Start

```bash
# Run ALL validation tests (recommended)
bash scripts/run-all-validations.sh

# Run individual tests
bash scripts/staging-validation.sh           # Infrastructure check
bash scripts/uat-testing.sh                  # User workflows
bash scripts/load-test-execution.sh          # Performance
bash scripts/monitoring-validation.sh        # Observability
bash scripts/security-penetration-test.sh    # Security
bash scripts/backup-restore-validation.sh    # Disaster recovery
bash scripts/final-launch-checklist.sh       # Go/no-go audit
```

## 📋 Before Running

```bash
# 1. Start server
cd server && npm start

# 2. Verify server
curl http://localhost:5000/api/health

# 3. Install Artillery (for load testing)
npm install -g artillery

# 4. Set environment variables (optional)
export API_URL="http://localhost:5000"
export TEST_USER_EMAIL="test@example.com"
export TEST_USER_PASSWORD="Test@123"
```

## 📊 Test Suite Overview

| Phase | Test | Duration | Exit Criteria |
|-------|------|----------|---------------|
| 1️⃣ | Staging Validation | 5 min | ≥90% pass, 0 failures |
| 2️⃣ | UAT Testing | 10 min | ≥90% success, smooth UX |
| 3️⃣ | Load Testing | 15 min | p95 <1s, errors <1% |
| 4️⃣ | Monitoring | 5 min | Health checks + logs OK |
| 5️⃣ | Security | 10 min | 0 vulnerabilities |
| 6️⃣ | Backup/Restore | 10 min | Restore successful |
| 7️⃣ | Launch Checklist | 5 min | ≥85% ready, 0 blockers |

**Total:** ~60 minutes

## 🎯 Performance Targets

| Metric | Target | Measured By |
|--------|--------|-------------|
| p50 response time | <500ms | Load testing |
| p95 response time | <1000ms | Load testing |
| p99 response time | <2000ms | Load testing |
| Error rate | <1% | Load testing |
| Concurrent users | 50-100 | Load testing |
| Health check | <1s | Staging validation |
| SSL certificate | Valid | Launch checklist |
| npm vulnerabilities | 0 | Launch checklist |

## 🔍 Interpreting Results

### ✅ READY FOR PRODUCTION
- All tests passed
- 0 blockers
- <3 warnings
- **Action:** Deploy to production

### ⚠️ CONDITIONAL GO
- Most tests passed
- Some warnings
- 0 critical blockers
- **Action:** Review warnings, assess risk

### ❌ NO-GO
- Tests failed
- Critical blockers present
- Security vulnerabilities
- **Action:** Fix issues, re-run validation

## 📁 Results Location

```
pre-launch-validation-YYYYMMDD_HHMMSS/
├── VALIDATION_REPORT.md          # Start here
├── summary.txt                   # Quick overview
└── phase[1-7]-*.log             # Detailed logs
```

## 🛠️ Common Issues

| Issue | Solution |
|-------|----------|
| "API not reachable" | `cd server && npm start` |
| "Artillery not found" | `npm install -g artillery` |
| "MongoDB client missing" | Install `mongosh` or `mongo` CLI |
| "Rate limiting fails" | Verify `express-rate-limit` in server |
| "Tests timeout" | Increase timeout in Artillery config |

## 🔒 Security Checklist

Before launch, ensure:

- [ ] Rate limiting on auth endpoints (HTTP 429 after 5 attempts)
- [ ] NoSQL injection sanitization (no `$ne`, `$gt` in queries)
- [ ] XSS protection (inputs sanitized, outputs escaped)
- [ ] File upload validation (.php, .exe blocked)
- [ ] JWT token security (tampering rejected, `alg: none` blocked)
- [ ] Security headers (HSTS, X-Frame-Options, CSP)
- [ ] CORS restricted (not wildcard `*`)
- [ ] 0 npm vulnerabilities (`npm audit`)

## 🚨 Launch Day Checklist

### Pre-Deployment
- [ ] All validation tests passed
- [ ] Staging environment validated
- [ ] Database backup verified
- [ ] SSL certificate valid
- [ ] Environment variables set
- [ ] Rollback plan documented

### Deployment
- [ ] Deploy during low-traffic window
- [ ] Monitor Sentry for errors
- [ ] Watch response times
- [ ] Check health endpoints
- [ ] Verify email delivery

### Post-Deployment (First 24h)
- [ ] Monitor error rates (<1%)
- [ ] Watch database performance
- [ ] Check user feedback
- [ ] Verify automated backups run
- [ ] Team on standby

## 📞 Getting Help

1. **View detailed logs:** `cat pre-launch-validation-*/VALIDATION_REPORT.md`
2. **Find errors:** `grep -r "FAIL\|ERROR" pre-launch-validation-*/`
3. **Check specific phase:** `cat pre-launch-validation-*/phase5-*.log`
4. **Full guide:** [PRE_LAUNCH_VALIDATION_GUIDE.md](./PRE_LAUNCH_VALIDATION_GUIDE.md)

## 🎓 Best Practices

### When to Run
- **Before staging deploy:** Full suite
- **Before production deploy:** Full suite + manual review
- **Weekly in dev:** Staging + UAT + Security
- **After major changes:** Full suite

### CI/CD Integration
```yaml
# Add to .github/workflows/
- name: Pre-Launch Validation
  run: |
    export RUN_LOAD=false
    bash scripts/run-all-validations.sh
```

## 📈 Validation Maturity Levels

### Level 1: Basic
- Run staging validation
- Manual launch checklist

### Level 2: Standard (Recommended)
- Full validation suite
- Review all reports
- Fix blockers

### Level 3: Advanced
- Full validation suite
- CI/CD integration
- Automated alerts
- Quarterly re-validation

## 🔗 Related Documentation

- [Production Hardening Guide](./PRODUCTION_HARDENING_IMPLEMENTATION.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Security Audit Report](./SECURITY_AUDIT.md)
- [Monitoring Setup](./MONITORING_SETUP.md)

---

**Remember:** 60 minutes of validation saves hours of production firefighting. ✨
