#!/bin/bash
#
# Staging Environment Validation Script
# Validates all infrastructure components before production launch
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
STAGING_API="${STAGING_API:-http://localhost:5000}"
STAGING_FRONTEND="${STAGING_FRONTEND:-http://localhost:5173}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/devplatform}"
TURN_SERVER="${TURN_SERVER:-turn:localhost:3478}"
SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}"

PASSED=0
FAILED=0
WARNINGS=0

# Create results directory
RESULTS_DIR="validation-results-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

log_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    echo "[PASS] $1" >> "$RESULTS_DIR/validation.log"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    echo "[FAIL] $1" >> "$RESULTS_DIR/validation.log"
    ((FAILED++))
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    echo "[WARN] $1" >> "$RESULTS_DIR/validation.log"
    ((WARNINGS++))
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# ==================== 1. INFRASTRUCTURE CONNECTIVITY ====================

log_header "1. INFRASTRUCTURE CONNECTIVITY"

# Test API Server
log_info "Testing API server..."
if curl -s -f -o /dev/null -w "%{http_code}" "$STAGING_API/api/health" | grep -q "200"; then
    log_pass "API server is responding"
    
    # Get detailed health
    HEALTH_RESPONSE=$(curl -s "$STAGING_API/api/health/detailed")
    echo "$HEALTH_RESPONSE" > "$RESULTS_DIR/health-check.json"
    
    # Check MongoDB status
    if echo "$HEALTH_RESPONSE" | grep -q '"status":"connected"'; then
        log_pass "MongoDB connected"
    else
        log_fail "MongoDB not connected"
    fi
    
    # Check Redis status
    if echo "$HEALTH_RESPONSE" | grep -q '"redis"'; then
        if echo "$HEALTH_RESPONSE" | grep -q '"status":"up"'; then
            log_pass "Redis connected"
        else
            log_warn "Redis not connected (graceful degradation)"
        fi
    else
        log_warn "Redis status not reported"
    fi
    
    # Check Socket.io
    if echo "$HEALTH_RESPONSE" | grep -q '"socketio"'; then
        log_pass "Socket.io server active"
    else
        log_warn "Socket.io status not reported"
    fi
else
    log_fail "API server not responding"
fi

# Test Redis directly
log_info "Testing Redis connection..."
if command -v redis-cli &> /dev/null; then
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
        log_pass "Redis direct connection works"
        
        # Test Redis operations
        TEST_KEY="staging_test_$(date +%s)"
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SET "$TEST_KEY" "test_value" EX 60 > /dev/null
        RETRIEVED=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" GET "$TEST_KEY")
        
        if [ "$RETRIEVED" == "test_value" ]; then
            log_pass "Redis SET/GET operations work"
        else
            log_fail "Redis SET/GET operations failed"
        fi
        
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" DEL "$TEST_KEY" > /dev/null
    else
        log_fail "Redis direct connection failed"
    fi
else
    log_info "redis-cli not installed, skipping direct Redis test"
fi

# Test MongoDB directly
log_info "Testing MongoDB connection..."
if command -v mongosh &> /dev/null || command -v mongo &> /dev/null; then
    MONGO_CMD=$(command -v mongosh || command -v mongo)
    if $MONGO_CMD --quiet "$MONGO_URI" --eval "db.adminCommand('ping')" 2>&1 | grep -q "ok"; then
        log_pass "MongoDB direct connection works"
        
        # Get database stats
        DB_STATS=$($MONGO_CMD --quiet "$MONGO_URI" --eval "JSON.stringify(db.stats())" 2>/dev/null)
        echo "$DB_STATS" > "$RESULTS_DIR/mongodb-stats.json"
        
        # Check indexes
        INDEXES=$($MONGO_CMD --quiet "$MONGO_URI" --eval "db.tasks.getIndexes()" 2>/dev/null)
        if echo "$INDEXES" | grep -q "projectId"; then
            log_pass "Database indexes exist"
        else
            log_warn "Task indexes may be missing"
        fi
    else
        log_fail "MongoDB direct connection failed"
    fi
else
    log_info "mongosh/mongo not installed, skipping direct MongoDB test"
fi

# ==================== 2. AUTHENTICATION FLOW ====================

log_header "2. AUTHENTICATION FLOW"

# Test user registration
log_info "Testing user registration..."
TEST_EMAIL="staging_test_$(date +%s)@example.com"
TEST_PASSWORD="StrongPass@123"

REGISTER_RESPONSE=$(curl -s -X POST "$STAGING_API/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Staging Test User\",
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

echo "$REGISTER_RESPONSE" > "$RESULTS_DIR/auth-register.json"

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    log_pass "User registration works"
    
    # Extract token
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        log_pass "JWT token generated"
        echo "TOKEN=$TOKEN" > "$RESULTS_DIR/test-token.txt"
        
        # Test authenticated endpoint
        log_info "Testing authenticated endpoint..."
        ME_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$STAGING_API/api/auth/me")
        echo "$ME_RESPONSE" > "$RESULTS_DIR/auth-me.json"
        
        if echo "$ME_RESPONSE" | grep -q "$TEST_EMAIL"; then
            log_pass "Authenticated requests work"
        else
            log_fail "Authenticated request failed"
        fi
        
        # Test token refresh (if endpoint exists)
        log_info "Testing token refresh..."
        REFRESH_RESPONSE=$(curl -s -X POST "$STAGING_API/api/auth/refresh" \
            -H "Content-Type: application/json" \
            -d "{\"refreshToken\": \"dummy\"}")
        
        if echo "$REFRESH_RESPONSE" | grep -q "token" || echo "$REFRESH_RESPONSE" | grep -q "error"; then
            log_pass "Refresh token endpoint exists"
        else
            log_warn "Refresh token endpoint may not be configured"
        fi
    else
        log_fail "JWT token not generated"
    fi
else
    log_fail "User registration failed"
    echo "Response: $REGISTER_RESPONSE"
fi

# Test login
log_info "Testing user login..."
LOGIN_RESPONSE=$(curl -s -X POST "$STAGING_API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"password\": \"$TEST_PASSWORD\"
    }")

echo "$LOGIN_RESPONSE" > "$RESULTS_DIR/auth-login.json"

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    log_pass "User login works"
else
    log_fail "User login failed"
fi

# Test invalid login
log_info "Testing invalid login (rate limiting)..."
for i in {1..5}; do
    curl -s -X POST "$STAGING_API/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"fake@test.com","password":"wrong"}' > /dev/null
done

RATE_LIMIT_TEST=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$STAGING_API/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"fake@test.com","password":"wrong"}')

if [ "$RATE_LIMIT_TEST" == "429" ]; then
    log_pass "Rate limiting is active"
else
    log_warn "Rate limiting may not be working (got HTTP $RATE_LIMIT_TEST)"
fi

# ==================== 3. WEBSOCKET CONNECTION ====================

log_header "3. WEBSOCKET CONNECTION"

log_info "Testing Socket.io endpoint..."
SOCKET_RESPONSE=$(curl -s "$STAGING_API/socket.io/")

if echo "$SOCKET_RESPONSE" | grep -q "Session ID unknown" || echo "$SOCKET_RESPONSE" | grep -q "Invalid"; then
    log_pass "Socket.io server is running"
else
    log_fail "Socket.io server not responding correctly"
fi

# ==================== 4. FILE UPLOAD ====================

log_header "4. FILE UPLOAD SYSTEM"

log_info "Testing file upload..."
if [ -n "$TOKEN" ]; then
    # Create a test file
    echo "This is a test file for staging validation" > "$RESULTS_DIR/test-upload.txt"
    
    UPLOAD_RESPONSE=$(curl -s -X POST "$STAGING_API/api/files/upload" \
        -H "Authorization: Bearer $TOKEN" \
        -F "file=@$RESULTS_DIR/test-upload.txt")
    
    echo "$UPLOAD_RESPONSE" > "$RESULTS_DIR/file-upload.json"
    
    if echo "$UPLOAD_RESPONSE" | grep -q '"success":true' || echo "$UPLOAD_RESPONSE" | grep -q "url"; then
        log_pass "File upload works"
    else
        log_fail "File upload failed"
    fi
else
    log_warn "Skipping file upload test (no token)"
fi

# ==================== 5. EMAIL DELIVERY ====================

log_header "5. EMAIL DELIVERY (SMTP)"

log_info "Testing SMTP connectivity..."
if command -v nc &> /dev/null || command -v telnet &> /dev/null; then
    SMTP_PORT=${SMTP_PORT:-587}
    
    if command -v nc &> /dev/null; then
        if timeout 5 nc -zv "$SMTP_HOST" "$SMTP_PORT" 2>&1 | grep -q "succeeded\|Connected"; then
            log_pass "SMTP server is reachable"
        else
            log_warn "Cannot reach SMTP server $SMTP_HOST:$SMTP_PORT"
        fi
    elif command -v telnet &> /dev/null; then
        if timeout 5 telnet "$SMTP_HOST" "$SMTP_PORT" 2>&1 | grep -q "Connected\|Escape"; then
            log_pass "SMTP server is reachable"
        else
            log_warn "Cannot reach SMTP server"
        fi
    fi
else
    log_info "nc/telnet not available, skipping SMTP connectivity test"
fi

# Check if email was sent during registration
log_info "Checking email configuration..."
if [ -f "$RESULTS_DIR/auth-register.json" ]; then
    if grep -q "email" "$RESULTS_DIR/auth-register.json"; then
        log_info "Email configuration appears to be set up"
    fi
fi

# ==================== 6. TURN SERVER ====================

log_header "6. TURN SERVER (WebRTC)"

log_info "Testing TURN server connectivity..."
TURN_HOST=$(echo "$TURN_SERVER" | cut -d: -f2 | sed 's#//##')
TURN_PORT=$(echo "$TURN_SERVER" | cut -d: -f3)

if command -v nc &> /dev/null; then
    if timeout 5 nc -zvu "$TURN_HOST" "${TURN_PORT:-3478}" 2>&1 | grep -q "succeeded\|Connected"; then
        log_pass "TURN server UDP port is reachable"
    else
        log_warn "TURN server UDP port not reachable (may be NAT/firewall)"
    fi
    
    if timeout 5 nc -zv "$TURN_HOST" "${TURN_PORT:-3478}" 2>&1 | grep -q "succeeded\|Connected"; then
        log_pass "TURN server TCP port is reachable"
    else
        log_warn "TURN server TCP port not reachable"
    fi
else
    log_info "nc not available, skipping TURN connectivity test"
fi

# ==================== 7. PERFORMANCE BASELINE ====================

log_header "7. PERFORMANCE BASELINE"

log_info "Measuring API response times..."
for endpoint in "/api/health" "/api/health/detailed"; do
    RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$STAGING_API$endpoint")
    RESPONSE_TIME_MS=$(echo "$RESPONSE_TIME * 1000" | bc)
    
    echo "$endpoint: ${RESPONSE_TIME_MS}ms" >> "$RESULTS_DIR/response-times.txt"
    
    if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
        log_pass "$endpoint responds in ${RESPONSE_TIME_MS}ms"
    elif (( $(echo "$RESPONSE_TIME < 3.0" | bc -l) )); then
        log_warn "$endpoint responds in ${RESPONSE_TIME_MS}ms (slow)"
    else
        log_fail "$endpoint responds in ${RESPONSE_TIME_MS}ms (too slow)"
    fi
done

# ==================== 8. SECURITY HEADERS ====================

log_header "8. SECURITY HEADERS"

log_info "Checking security headers..."
HEADERS=$(curl -s -I "$STAGING_API/api/health")
echo "$HEADERS" > "$RESULTS_DIR/security-headers.txt"

# Check for important security headers
if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
    log_pass "X-Content-Type-Options header present"
else
    log_warn "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
    log_pass "X-Frame-Options header present"
else
    log_warn "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
    log_pass "HSTS header present"
else
    log_warn "HSTS header missing (expected for production)"
fi

if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
    log_pass "CSP header present"
else
    log_warn "CSP header missing (recommended)"
fi

# ==================== 9. ENVIRONMENT VALIDATION ====================

log_header "9. ENVIRONMENT VALIDATION"

log_info "Checking environment configuration..."

# Check if running in production mode
if curl -s "$STAGING_API/api/health" | grep -q '"environment":"production"'; then
    log_pass "Running in production mode"
elif curl -s "$STAGING_API/api/health" | grep -q '"environment":"staging"'; then
    log_pass "Running in staging mode"
else
    log_warn "Environment not set to production/staging"
fi

# ==================== 10. DOCUMENTATION VERIFICATION ====================

log_header "10. DOCUMENTATION VERIFICATION"

REQUIRED_DOCS=(
    "README.md"
    "DEPLOYMENT_GUIDE.md"
    "PRODUCTION_HARDENING_IMPLEMENTATION.md"
    "SECURITY_AUDIT.md"
    "ARCHITECTURE.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "../$doc" ]; then
        log_pass "$doc exists"
    else
        log_warn "$doc not found"
    fi
done

# ==================== SUMMARY ====================

log_header "VALIDATION SUMMARY"

TOTAL=$((PASSED + FAILED + WARNINGS))
PASS_RATE=$((PASSED * 100 / TOTAL))

echo -e "\n${GREEN}Passed:${NC}   $PASSED"
echo -e "${RED}Failed:${NC}   $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "Total:    $TOTAL"
echo -e "Pass Rate: ${PASS_RATE}%\n"

# Write summary to file
cat > "$RESULTS_DIR/summary.txt" << EOF
STAGING VALIDATION SUMMARY
==========================
Date: $(date)
Environment: $STAGING_API

Results:
- Passed:   $PASSED
- Failed:   $FAILED
- Warnings: $WARNINGS
- Total:    $TOTAL
- Pass Rate: ${PASS_RATE}%

Status: $(if [ "$FAILED" -eq 0 ] && [ "$PASS_RATE" -ge 80 ]; then echo "READY FOR PRODUCTION"; elif [ "$FAILED" -gt 0 ]; then echo "NEEDS FIXES"; else echo "REVIEW WARNINGS"; fi)
EOF

echo -e "\n📊 Detailed results saved to: ${BLUE}$RESULTS_DIR/${NC}\n"

# Final verdict
if [ "$FAILED" -eq 0 ] && [ "$PASS_RATE" -ge 90 ]; then
    echo -e "${GREEN}✓ STAGING VALIDATION PASSED${NC}"
    echo -e "${GREEN}Ready for load testing and UAT${NC}\n"
    exit 0
elif [ "$FAILED" -eq 0 ] && [ "$PASS_RATE" -ge 80 ]; then
    echo -e "${YELLOW}⚠ STAGING VALIDATION MOSTLY PASSED${NC}"
    echo -e "${YELLOW}Review warnings before proceeding${NC}\n"
    exit 0
else
    echo -e "${RED}✗ STAGING VALIDATION FAILED${NC}"
    echo -e "${RED}Fix $FAILED critical issue(s) before load testing${NC}\n"
    exit 1
fi
