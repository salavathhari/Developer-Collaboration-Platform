#!/bin/bash
#
# Production Deployment Validation Script
# Validates all components before going live
#

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/devplatform}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

PASSED=0
FAILED=0

log_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        log_pass "$1 is installed"
        return 0
    else
        log_fail "$1 is not installed"
        return 1
    fi
}

check_url() {
    local url="$1"
    local name="$2"
    
    if curl -s -f -o /dev/null "$url"; then
        log_pass "$name is accessible ($url)"
        return 0
    else
        log_fail "$name is not accessible ($url)"
        return 1
    fi
}

# ==================== PREREQUISITES ====================

log_header "1. CHECKING PREREQUISITES"

check_command "node"
check_command "npm"
check_command "mongod" || check_command "mongo" || log_info "MongoDB may be in Docker"
check_command "redis-cli" || log_info "Redis may be in Docker"
check_command "docker" || log_info "Docker not required for manual deployment"
check_command "docker-compose" || log_info "Docker Compose not required for manual deployment"
check_command "nginx" || log_info "Nginx optional for development"
check_command "pm2" || log_info "PM2 recommended for production"

# ==================== ENVIRONMENT VARIABLES ====================

log_header "2. VALIDATING ENVIRONMENT VARIABLES"

ENV_FILE="${1:-.env}"

if [ -f "$ENV_FILE" ]; then
    log_pass "Environment file exists: $ENV_FILE"
    source "$ENV_FILE"
else
    log_fail "Environment file not found: $ENV_FILE"
    log_info "Copy .env.example to $ENV_FILE and configure"
fi

# Check critical variables
check_var() {
    local var_name="$1"
    local var_value="${!var_name}"
    
    if [ -n "$var_value" ]; then
        log_pass "$var_name is set"
    else
        log_fail "$var_name is not set"
    fi
}

check_var "MONGO_URI"
check_var "JWT_SECRET"
check_var "JWT_REFRESH_SECRET"
check_var "NODE_ENV"

# Optional but recommended
[ -n "$REDIS_URL" ] && log_pass "REDIS_URL is set" || log_info "REDIS_URL not set (caching disabled)"
[ -n "$SMTP_HOST" ] && log_pass "SMTP_HOST is set" || log_info "SMTP not configured (emails disabled)"
[ -n "$SENTRY_DSN" ] && log_pass "SENTRY_DSN is set" || log_info "Sentry not configured (error tracking disabled)"

# ==================== DATABASE CONNECTIVITY ====================

log_header "3. CHECKING DATABASE CONNECTIVITY"

# MongoDB
log_info "Testing MongoDB connection..."
if mongosh --quiet "$MONGO_URI" --eval "db.adminCommand('ping')" &> /dev/null || \
   mongo --quiet "$MONGO_URI" --eval "db.adminCommand('ping')" &> /dev/null; then
    log_pass "MongoDB is accessible"
else
    log_fail "MongoDB connection failed"
    log_info "Verify MONGO_URI: $MONGO_URI"
fi

# Redis
if [ -n "$REDIS_URL" ]; then
    log_info "Testing Redis connection..."
    REDIS_HOST=$(echo "$REDIS_URL" | sed -n 's/.*:\/\/\([^:]*\).*/\1/p')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -n 's/.*:\([0-9]*\).*/\1/p')
    
    if redis-cli -h "${REDIS_HOST:-localhost}" -p "${REDIS_PORT:-6379}" ping &> /dev/null; then
        log_pass "Redis is accessible"
    else
        log_fail "Redis connection failed"
    fi
fi

# ==================== APPLICATION HEALTH ====================

log_header "4. CHECKING APPLICATION HEALTH"

# Start server if not running
if ! curl -s -f -o /dev/null "$API_URL/api/health"; then
    log_info "Server not running. Attempting to start..."
    
    if [ -f "package.json" ]; then
        npm start &
        SERVER_PID=$!
        sleep 5
    else
        log_fail "package.json not found. Cannot start server."
    fi
fi

# Basic health check
check_url "$API_URL/api/health" "Basic Health Endpoint"

# Detailed health check
if curl -s "$API_URL/api/health/detailed" | grep -q '"status":"ok"'; then
    log_pass "Detailed health check passed"
else
    log_fail "Detailed health check failed"
fi

# Readiness check
check_url "$API_URL/api/health/readiness" "Readiness Probe"

# Liveness check
check_url "$API_URL/api/health/liveness" "Liveness Probe"

# ==================== API ENDPOINTS ====================

log_header "5. TESTING CRITICAL API ENDPOINTS"

# Test public endpoints
check_url "$API_URL/api/auth/login" "Auth Login Endpoint (should return 400/404, not 500)"

# Register test user
log_info "Testing user registration..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test_'$(date +%s)'@example.com",
    "password": "Test@12345"
  }')

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    log_pass "User registration works"
    
    # Extract token
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        log_pass "JWT token generated"
        
        # Test authenticated endpoint
        if curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/auth/me" | grep -q '"success":true'; then
            log_pass "Authenticated endpoint works"
        else
            log_fail "Authenticated endpoint failed"
        fi
    fi
else
    log_fail "User registration failed"
fi

# ==================== WEBSOCKET ====================

log_header "6. CHECKING WEBSOCKET SERVER"

# Test Socket.io endpoint
if curl -s "$API_URL/socket.io/" | grep -q "Session ID unknown"; then
    log_pass "Socket.io server is running"
else
    log_fail "Socket.io server not responding"
fi

# ==================== FILE UPLOADS ====================

log_header "7. TESTING FILE UPLOAD PERMISSIONS"

UPLOAD_DIR="${UPLOAD_DIR:-uploads}"

for dir in "$UPLOAD_DIR" "$UPLOAD_DIR/avatars" "$UPLOAD_DIR/files" "$UPLOAD_DIR/tasks"; do
    if [ -d "$dir" ]; then
        if [ -w "$dir" ]; then
            log_pass "Directory $dir is writable"
        else
            log_fail "Directory $dir is not writable"
        fi
    else
        log_fail "Directory $dir does not exist"
        log_info "Creating directory: $dir"
        mkdir -p "$dir"
    fi
done

# ==================== SECURITY CHECKS ====================

log_header "8. RUNNING SECURITY CHECKS"

# Check for npm vulnerabilities
log_info "Running npm audit..."
if npm audit --audit-level=high > /dev/null 2>&1; then
    log_pass "No high/critical npm vulnerabilities"
else
    log_fail "npm vulnerabilities found (run: npm audit)"
fi

# Check JWT secrets
if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -ge 32 ]; then
    log_pass "JWT_SECRET is strong (>= 32 chars)"
else
    log_fail "JWT_SECRET is weak (should be >= 32 chars)"
fi

if [ -n "$JWT_REFRESH_SECRET" ] && [ ${#JWT_REFRESH_SECRET} -ge 32 ]; then
    log_pass "JWT_REFRESH_SECRET is strong"
else
    log_fail "JWT_REFRESH_SECRET is weak"
fi

# Check for default passwords
if grep -qi "password.*password" "$ENV_FILE" 2>/dev/null; then
    log_fail "Default passwords detected in $ENV_FILE"
else
    log_pass "No default passwords detected"
fi

# ==================== PERFORMANCE ====================

log_header "9. BASIC PERFORMANCE TEST"

log_info "Testing API response time..."
START=$(date +%s%3N)
curl -s -o /dev/null "$API_URL/api/health"
END=$(date +%s%3N)
DURATION=$((END - START))

if [ "$DURATION" -lt 1000 ]; then
    log_pass "Health endpoint responds in ${DURATION}ms (< 1s)"
elif [ "$DURATION" -lt 3000 ]; then
    log_info "Health endpoint responds in ${DURATION}ms (acceptable)"
else
    log_fail "Health endpoint slow: ${DURATION}ms (> 3s)"
fi

# ==================== DOCKER (if available) ====================

if command -v docker &> /dev/null; then
    log_header "10. DOCKER VALIDATION"
    
    # Check if docker-compose.yml exists
    if [ -f "docker-compose.yml" ]; then
        log_pass "docker-compose.yml found"
        
        log_info "Validating docker-compose configuration..."
        if docker-compose config > /dev/null 2>&1; then
            log_pass "docker-compose.yml is valid"
        else
            log_fail "docker-compose.yml has errors"
        fi
    else
        log_info "docker-compose.yml not found"
    fi
    
    # Check Dockerfiles
    [ -f "server/Dockerfile" ] && log_pass "Backend Dockerfile exists" || log_fail "Backend Dockerfile missing"
    [ -f "client/Dockerfile" ] && log_pass "Frontend Dockerfile exists" || log_fail "Frontend Dockerfile missing"
fi

# ==================== SUMMARY ====================

log_header "VALIDATION SUMMARY"

TOTAL=$((PASSED + FAILED))
PASS_RATE=$((PASSED * 100 / TOTAL))

echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "Total: $TOTAL"
echo -e "Pass Rate: ${PASS_RATE}%\n"

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED! Ready for production.${NC}\n"
    exit 0
elif [ "$PASS_RATE" -ge 80 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY READY. Fix $FAILED issue(s) before deploying.${NC}\n"
    exit 1
else
    echo -e "${RED}❌ NOT READY FOR PRODUCTION. Fix $FAILED critical issues.${NC}\n"
    exit 1
fi
