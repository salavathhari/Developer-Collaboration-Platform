#!/bin/bash
#
# Final Production Launch Checklist
# Comprehensive pre-launch validation
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Results
RESULTS_DIR="launch-checklist-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

READY_COUNT=0
WARNING_COUNT=0
BLOCKER_COUNT=0

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
STAGING_URL="${STAGING_URL:-}"
PRODUCTION_URL="${PRODUCTION_URL:-}"

log_category() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_ready() {
    echo -e "${GREEN}✓ READY:${NC} $1"
    ((READY_COUNT++))
}

log_warning() {
    echo -e "${YELLOW}⚠ WARNING:${NC} $1"
    ((WARNING_COUNT++))
}

log_blocker() {
    echo -e "${RED}✗ BLOCKER:${NC} $1"
    ((BLOCKER_COUNT++))
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_file() {
    local file=$1
    local name=$2
    
    if [ -f "$file" ]; then
        log_ready "$name exists"
        return 0
    else
        log_blocker "$name missing: $file"
        return 1
    fi
}

check_env_var() {
    local var_name=$1
    local description=$2
    local is_critical=${3:-true}
    
    if [ -n "${!var_name}" ]; then
        log_ready "$description configured"
        return 0
    else
        if [ "$is_critical" = true ]; then
            log_blocker "$description not set ($var_name)"
            return 1
        else
            log_warning "$description not set ($var_name) - may be optional"
            return 0
        fi
    fi
}

echo -e "\n${PURPLE}═══════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}     PRODUCTION LAUNCH READINESS CHECKLIST${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}\n"

log_info "Target Environment: ${PRODUCTION_URL:-$API_URL}"
log_info "Validation Time: $(date)"

# =================================================================
# CATEGORY 1: SSL/TLS CERTIFICATES
# =================================================================

log_category "1. SSL/TLS & HTTPS"

# Check if HTTPS is configured
if [ -n "$PRODUCTION_URL" ]; then
    if [[ "$PRODUCTION_URL" == https://* ]]; then
        log_ready "Production URL uses HTTPS"
        
        # Test SSL certificate
        log_info "Checking SSL certificate..."
        
        CERT_INFO=$(echo | openssl s_client -servername "${PRODUCTION_URL#https://}" -connect "${PRODUCTION_URL#https://}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        
        if [ -n "$CERT_INFO" ]; then
            log_ready "SSL certificate valid"
            
            # Check expiry
            EXPIRY_DATE=$(echo "$CERT_INFO" | grep "notAfter" | cut -d'=' -f2)
            log_info "Certificate expires: $EXPIRY_DATE"
            
            echo "$CERT_INFO" > "$RESULTS_DIR/ssl-cert-info.txt"
        else
            log_warning "Could not verify SSL certificate (may need manual check)"
        fi
    else
        log_blocker "Production URL does not use HTTPS: $PRODUCTION_URL"
    fi
else
    log_warning "PRODUCTION_URL not set - verify HTTPS in deployment"
fi

# Check HSTS header
if [ -n "$PRODUCTION_URL" ] && [[ "$PRODUCTION_URL" == https://* ]]; then
    HSTS_CHECK=$(curl -I -s "$PRODUCTION_URL" | grep -i "Strict-Transport-Security" || echo "")
    
    if [ -n "$HSTS_CHECK" ]; then
        log_ready "HSTS header enabled"
    else
        log_warning "HSTS header not found (recommended for HTTPS)"
    fi
fi

# =================================================================
# CATEGORY 2: SECRETS & ENVIRONMENT VARIABLES
# =================================================================

log_category "2. Secrets Management"

# Check for .env file
if [ -f "./server/.env" ]; then
    log_info "Environment file found: ./server/.env"
    
    # Check for sensitive data exposure
    if grep -q "password.*=.*admin" "./server/.env" 2>/dev/null; then
        log_blocker "Weak password detected in .env file"
    fi
    
    # Check for example values
    if grep -q "your.*here" "./server/.env" 2>/dev/null; then
        log_blocker "Placeholder values in .env (replace with real secrets)"
    fi
    
    # Check critical environment variables
    if grep -q "^JWT_SECRET=" "./server/.env"; then
        JWT_LENGTH=$(grep "^JWT_SECRET=" "./server/.env" | cut -d'=' -f2 | wc -c)
        
        if [ "$JWT_LENGTH" -gt 32 ]; then
            log_ready "JWT_SECRET is strong (length: $JWT_LENGTH)"
        else
            log_blocker "JWT_SECRET too weak (length: $JWT_LENGTH, min: 32)"
        fi
    else
        log_blocker "JWT_SECRET not configured"
    fi
    
    # Check MongoDB URI
    if grep -q "^MONGO_URI=" "./server/.env" || grep -q "^MONGODB_URI=" "./server/.env"; then
        MONGO_URI=$(grep "^MONGO.*URI=" "./server/.env" | cut -d'=' -f2)
        
        if [[ "$MONGO_URI" == *"mongodb+srv"* ]]; then
            log_ready "Using MongoDB Atlas (cloud)"
        elif [[ "$MONGO_URI" == *"localhost"* ]]; then
            log_warning "MongoDB points to localhost (ensure correct for production)"
        else
            log_ready "MongoDB URI configured"
        fi
    else
        log_blocker "MongoDB URI not configured"
    fi
    
    # Check Redis
    if grep -q "^REDIS_URL=" "./server/.env"; then
        log_ready "Redis configured"
    else
        log_warning "Redis not configured (performance may be limited)"
    fi
    
    # Check Sentry
    if grep -q "^SENTRY_DSN=" "./server/.env"; then
        log_ready "Sentry error tracking configured"
    else
        log_warning "Sentry not configured (error tracking recommended)"
    fi
    
    # Check email/SMTP
    if grep -q "^SMTP_" "./server/.env" || grep -q "^EMAIL_" "./server/.env"; then
        log_ready "Email/SMTP configured"
    else
        log_warning "Email not configured (notifications may not work)"
    fi
else
    log_blocker "No .env file found at ./server/.env"
fi

# Check for secrets in version control
if git check-ignore .env &> /dev/null || grep -q "\.env" .gitignore 2>/dev/null; then
    log_ready ".env excluded from version control"
else
    log_blocker ".env not in .gitignore - secrets may be committed!"
fi

# =================================================================
# CATEGORY 3: DATABASE & DATA
# =================================================================

log_category "3. Database Configuration"

# Check MongoDB connection
log_info "Testing database connection..."

if curl -s "$API_URL/api/health/detailed" | grep -q '"mongodb".*"connected":true'; then
    log_ready "Database connection successful"
else
    log_blocker "Cannot connect to database"
fi

# Check for indexes
log_info "Verifying database indexes..."

if [ -f "./server/src/models/User.js" ]; then
    if grep -q "index" "./server/src/models/User.js"; then
        log_ready "Database indexes defined in models"
    else
        log_warning "No indexes found in User model (may impact performance)"
    fi
fi

# Check backup configuration
if [ -f "./server/scripts/backup-mongodb.sh" ]; then
    log_ready "Backup script exists"
    
    # Check if backup is scheduled
    if crontab -l 2>/dev/null | grep -q "backup-mongodb"; then
        log_ready "Automated backups scheduled"
    else
        log_warning "No automated backup schedule detected"
    fi
else
    log_blocker "No backup script found"
fi

# =================================================================
# CATEGORY 4: MONITORING & OBSERVABILITY
# =================================================================

log_category "4. Monitoring & Alerts"

# Check health endpoints
if curl -s "$API_URL/api/health" | grep -q '"status":"ok"'; then
    log_ready "Health check endpoint operational"
else
    log_blocker "Health check endpoint not responding"
fi

# Check logging
if [ -f "./server/src/utils/logger.js" ]; then
    log_ready "Logger utility exists"
    
    if grep -q "pino" "./server/src/utils/logger.js"; then
        log_ready "Production-grade logger (Pino) configured"
    else
        log_warning "Logger may not be production-ready"
    fi
else
    log_blocker "No logger utility found"
fi

# Check Sentry integration
if [ -f "./server/src/utils/sentry.js" ] || grep -q "@sentry/node" "./server/package.json"; then
    log_ready "Sentry error tracking integrated"
else
    log_warning "Sentry not integrated (error tracking recommended)"
fi

# Check monitoring dashboards
log_info "Verify monitoring dashboards are configured:"
log_info "  - Sentry dashboard for errors"
log_info "  - MongoDB Atlas dashboard (if using Atlas)"
log_info "  - Server metrics (CPU, memory, disk)"

# =================================================================
# CATEGORY 5: CI/CD & DEPLOYMENT
# =================================================================

log_category "5. CI/CD Pipeline"

# Check for GitHub Actions
if [ -f ".github/workflows/ci.yml" ] || [ -f ".github/workflows/deploy.yml" ]; then
    log_ready "GitHub Actions workflow exists"
else
    log_warning "No CI/CD workflow detected"
fi

# Check Docker configuration
if [ -f "docker-compose.yml" ]; then
    log_ready "Docker Compose configuration exists"
    
    # Check for production configuration
    if [ -f "docker-compose.prod.yml" ]; then
        log_ready "Production Docker Compose configuration exists"
    else
        log_warning "No dedicated production Docker Compose file"
    fi
fi

if [ -f "server/Dockerfile" ] && [ -f "client/Dockerfile" ]; then
    log_ready "Dockerfiles for client and server exist"
else
    log_warning "Dockerfile(s) missing"
fi

# Check for deployment scripts
if [ -f "scripts/deploy.sh" ] || [ -f "./deploy.sh" ]; then
    log_ready "Deployment script exists"
else
    log_warning "No deployment script found"
fi

# =================================================================
# CATEGORY 6: SECURITY
# =================================================================

log_category "6. Security Hardening"

# Check npm vulnerabilities
log_info "Checking for npm vulnerabilities..."

cd server
AUDIT_RESULT=$(npm audit --production --json 2>/dev/null || echo '{"vulnerabilities":{"total":999}}')
cd ..

VULN_COUNT=$(echo "$AUDIT_RESULT" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")

if [ "$VULN_COUNT" -eq 0 ]; then
    log_ready "No npm vulnerabilities (server)"
elif [ "$VULN_COUNT" -lt 5 ]; then
    log_warning "$VULN_COUNT npm vulnerabilities (review severity)"
else
    log_blocker "$VULN_COUNT npm vulnerabilities detected"
fi

# Check for rate limiting
if grep -r "rate.*limit" "./server/src" &> /dev/null || grep -q "express-rate-limit" "./server/package.json"; then
    log_ready "Rate limiting implemented"
else
    log_blocker "No rate limiting detected (critical for production)"
fi

# Check for Helmet (security headers)
if grep -q "helmet" "./server/package.json"; then
    log_ready "Helmet security headers configured"
else
    log_warning "Helmet not found (security headers recommended)"
fi

# Check CORS configuration
if grep -r "cors" "./server/src/app.js" &> /dev/null; then
    log_ready "CORS configuration present"
    
    if grep -r "origin.*\*" "./server/src/app.js" &> /dev/null; then
        log_blocker "CORS allows all origins (*) - restrict in production"
    else
        log_ready "CORS properly restricted"
    fi
else
    log_warning "CORS configuration not found"
fi

# =================================================================
# CATEGORY 7: PERFORMANCE & SCALABILITY
# =================================================================

log_category "7. Performance & Scalability"

# Check for caching
if [ -f "./server/src/services/redisService.js" ] || grep -q "redis" "./server/package.json"; then
    log_ready "Redis caching implemented"
else
    log_warning "No caching layer (Redis recommended for production)"
fi

# Check for clustering/PM2
if grep -q "pm2" "./server/package.json" || [ -f "ecosystem.config.js" ]; then
    log_ready "PM2 process manager configured"
else
    log_warning "PM2 not configured (recommended for production)"
fi

# Check for compression
if grep -q "compression" "./server/package.json"; then
    log_ready "Response compression enabled"
else
    log_warning "Response compression not configured"
fi

# =================================================================
# CATEGORY 8: DOCUMENTATION
# =================================================================

log_category "8. Documentation"

check_file "README.md" "README"
check_file "QUICK_START.md" "Quick Start Guide"
check_file "DEPLOYMENT_GUIDE.md" "Deployment Guide" || log_warning "Deployment guide missing (recommended)"
check_file "ARCHITECTURE.md" "Architecture Documentation" || log_warning "Architecture docs missing"

# Check for API documentation
if [ -f "API_DOCUMENTATION.md" ] || [ -f "docs/api.md" ]; then
    log_ready "API documentation exists"
else
    log_warning "API documentation not found"
fi

# =================================================================
# CATEGORY 9: TESTING
# =================================================================

log_category "9. Test Coverage"

# Check if tests exist
if [ -f "server/jest.config.js" ] && ls server/tests/*.test.js &> /dev/null; then
    log_ready "Backend tests configured"
    
    log_info "Running backend tests..."
    cd server
    if npm test &> "../$RESULTS_DIR/test-results.log"; then
        log_ready "All backend tests passing"
    else
        log_blocker "Backend tests failing - check $RESULTS_DIR/test-results.log"
    fi
    cd ..
else
    log_warning "Backend tests not found or not configured"
fi

# Check client tests
if [ -f "client/package.json" ] && grep -q "test" "client/package.json"; then
    log_ready "Frontend tests configured"
else
    log_warning "Frontend tests not configured"
fi

# =================================================================
# CATEGORY 10: FINAL VALIDATIONS
# =================================================================

log_category "10. Final Validations"

# Check if staging validation was run
if [ -f "validation-results*/summary.txt" ]; then
    log_ready "Staging validation completed"
else
    log_warning "Run staging validation: ./scripts/staging-validation.sh"
fi

# Check if UAT was performed
if [ -f "uat-results*/uat-report.md" ]; then
    log_ready "UAT testing completed"
else
    log_warning "Run UAT: ./scripts/uat-testing.sh"
fi

# Check if load testing was performed
if [ -f "load-test-results*/performance-report.md" ]; then
    log_ready "Load testing completed"
else
    log_warning "Run load tests: ./scripts/load-test-execution.sh"
fi

# Check if security testing was performed
if [ -f "security-test*/security-report.md" ]; then
    log_ready "Security testing completed"
else
    log_blocker "Run security tests: ./scripts/security-penetration-test.sh"
fi

# =================================================================
# SUMMARY & LAUNCH DECISION
# =================================================================

TOTAL_ITEMS=$((READY_COUNT + WARNING_COUNT + BLOCKER_COUNT))
READINESS_SCORE=$((READY_COUNT * 100 / TOTAL_ITEMS))

echo -e "\n${PURPLE}═══════════════════════════════════════════════════════${NC}"
echo -e "${PURPLE}     LAUNCH READINESS SUMMARY${NC}"
echo -e "${PURPLE}═══════════════════════════════════════════════════════${NC}\n"

echo -e "${GREEN}✓ Ready:${NC}      $READY_COUNT"
echo -e "${YELLOW}⚠ Warnings:${NC}  $WARNING_COUNT"
echo -e "${RED}✗ Blockers:${NC}  $BLOCKER_COUNT"
echo -e "Total Items:   $TOTAL_ITEMS"
echo -e "Readiness:     ${READINESS_SCORE}%\n"

# Generate final report
cat > "$RESULTS_DIR/launch-readiness-report.md" << EOF
# Production Launch Readiness Report

**Date:** $(date)  
**Evaluated By:** Automated Checklist  
**Target Environment:** ${PRODUCTION_URL:-$API_URL}

## Executive Summary

- **Ready Items:** $READY_COUNT
- **Warnings:** $WARNING_COUNT
- **Blockers:** $BLOCKER_COUNT
- **Readiness Score:** ${READINESS_SCORE}%

## Launch Decision

$(if [ "$BLOCKER_COUNT" -eq 0 ] && [ "$READINESS_SCORE" -ge 85 ]; then
    echo "### ✅ GO FOR LAUNCH"
    echo ""
    echo "The platform meets production readiness criteria."
    echo ""
    if [ "$WARNING_COUNT" -gt 0 ]; then
        echo "**Note:** $WARNING_COUNT warning(s) detected. Review and address post-launch."
    fi
elif [ "$BLOCKER_COUNT" -eq 0 ]; then
    echo "### ⚠️ CONDITIONAL GO"
    echo ""
    echo "Platform is functional but has $WARNING_COUNT areas for improvement."
    echo ""
    echo "Recommendation: Address critical warnings before full production rollout."
else
    echo "### ❌ NO-GO FOR LAUNCH"
    echo ""
    echo "**$BLOCKER_COUNT blocker(s) must be resolved before production launch.**"
    echo ""
    echo "Critical issues prevent safe production deployment."
fi)

## Category Breakdown

### 1. SSL/TLS & HTTPS
- Status: $([ -n "$PRODUCTION_URL" ] && [[ "$PRODUCTION_URL" == https://* ]] && echo "✅ Ready" || echo "⚠️ Review")

### 2. Secrets Management
- Status: $([ -f "./server/.env" ] && echo "✅ Configured" || echo "❌ Blocker")

### 3. Database Configuration
- Status: $(curl -s "$API_URL/api/health" | grep -q "ok" && echo "✅ Ready" || echo "❌ Blocker")

### 4. Monitoring & Alerts
- Status: $([ -f "./server/src/utils/logger.js" ] && echo "✅ Ready" || echo "⚠️ Review")

### 5. CI/CD Pipeline
- Status: $([ -f ".github/workflows/ci.yml" ] && echo "✅ Ready" || echo "⚠️ Optional")

### 6. Security Hardening
- Status: $([ "$VULN_COUNT" -eq 0 ] && echo "✅ Secure" || echo "⚠️ Review")

### 7. Performance & Scalability
- Status: $([ -f "./server/src/services/redisService.js" ] && echo "✅ Ready" || echo "⚠️ Review")

### 8. Documentation
- Status: $([ -f "README.md" ] && echo "✅ Ready" || echo "⚠️ Review")

### 9. Test Coverage
- Status: $([ -f "server/jest.config.js" ] && echo "✅ Ready" || echo "⚠️ Review")

### 10. Final Validations
- Status: $([ "$BLOCKER_COUNT" -eq 0 ] && echo "✅ Complete" || echo "❌ Incomplete")

## Action Items

### Critical (Must Fix)
$(if [ "$BLOCKER_COUNT" -gt 0 ]; then
    echo "1. Review blockers above and fix before launch"
    echo "2. Re-run this checklist after fixes"
else
    echo "None - all critical items resolved ✅"
fi)

### Important (Should Fix)
$(if [ "$WARNING_COUNT" -gt 0 ]; then
    echo "1. Review $WARNING_COUNT warning(s) above"
    echo "2. Prioritize based on business impact"
    echo "3. Address high-priority warnings post-launch"
else
    echo "None - all items ready ✅"
fi)

## Pre-Launch TODO

- [ ] Verify all blockers resolved
- [ ] Review security test results
- [ ] Confirm backup/restore tested
- [ ] Verify monitoring dashboards operational
- [ ] Test staging environment end-to-end
- [ ] Notify team of launch schedule
- [ ] Prepare rollback plan
- [ ] Document incident response procedures

## Launch Day Checklist

- [ ] Final staging validation
- [ ] Database backup confirmed
- [ ] SSL certificate verified
- [ ] Environment variables deployed
- [ ] Health checks passing
- [ ] Monitoring alerts configured
- [ ] Team on standby for first 24h
- [ ] Communication plan ready

## Post-Launch Monitoring (First 24h)

- [ ] Monitor error rates (Sentry)
- [ ] Watch response times
- [ ] Check database performance
- [ ] Verify email delivery
- [ ] Monitor user feedback
- [ ] Check backup execution

## Artifacts

- Full checklist results: \`$RESULTS_DIR/\`
- Test results: \`$RESULTS_DIR/test-results.log\`

---

**Report Generated:** $(date)  
**Next Review:** Re-run checklist after addressing blockers
EOF

log_info "Launch readiness report saved: $RESULTS_DIR/launch-readiness-report.md"

# Final verdict
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$BLOCKER_COUNT" -eq 0 ] && [ "$READINESS_SCORE" -ge 85 ]; then
    echo -e "${GREEN}🚀 GO FOR LAUNCH${NC}"
    echo -e "${GREEN}Platform is production-ready!${NC}"
    echo -e "${GREEN}Readiness Score: ${READINESS_SCORE}%${NC}\n"
    exit 0
elif [ "$BLOCKER_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  CONDITIONAL GO${NC}"
    echo -e "${YELLOW}Platform is functional with $WARNING_COUNT warning(s)${NC}"
    echo -e "${YELLOW}Review warnings before full rollout${NC}\n"
    exit 0
else
    echo -e "${RED}❌ NO-GO FOR LAUNCH${NC}"
    echo -e "${RED}Fix $BLOCKER_COUNT blocker(s) before production${NC}"
    echo -e "${RED}Review: $RESULTS_DIR/launch-readiness-report.md${NC}\n"
    exit 1
fi
