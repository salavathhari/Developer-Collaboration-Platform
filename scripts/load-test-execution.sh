#!/bin/bash
#
# Load Testing Execution & Performance Analysis Script
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:5000}"
TEST_USER_EMAIL="${TEST_USER_EMAIL:-test@example.com}"
TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-Test@123}"
ARTILLERY_CONFIG="${ARTILLERY_CONFIG:-./server/load-testing/artillery-production.yml}"

# Results
RESULTS_DIR="load-test-results-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}LOAD TESTING & PERFORMANCE ANALYSIS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check if server is running
if ! curl -s "$API_URL/api/health" > /dev/null; then
    log_error "API server not reachable at $API_URL"
    exit 1
fi
log_success "API server is reachable"

# Check if Artillery is installed
if ! command -v artillery &> /dev/null; then
    log_error "Artillery is not installed. Run: npm install -g artillery"
    exit 1
fi
log_success "Artillery CLI found"

# Check if test user exists (create if not)
log_info "Checking test user setup..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_USER_EMAIL\", \"password\": \"$TEST_USER_PASSWORD\"}")

if ! echo "$LOGIN_RESPONSE" | grep -q '"token"'; then
    log_info "Test user not found, creating..."
    
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"Load Test User\",
            \"email\": \"$TEST_USER_EMAIL\",
            \"password\": \"$TEST_USER_PASSWORD\"
        }")
    
    if echo "$REGISTER_RESPONSE" | grep -q '"token"'; then
        log_success "Test user created"
        
        # Get project ID
        TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        
        # Create test project
        PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/api/projects" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"name": "Load Test Project", "description": "For load testing"}')
        
        TEST_PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
        
        if [ -n "$TEST_PROJECT_ID" ]; then
            log_success "Test project created: $TEST_PROJECT_ID"
            export TEST_PROJECT_ID
        fi
    else
        log_error "Failed to create test user"
        exit 1
    fi
else
    log_success "Test user exists"
    
    # Get project ID from existing user
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    PROJECTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/projects")
    TEST_PROJECT_ID=$(echo "$PROJECTS_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ -n "$TEST_PROJECT_ID" ]; then
        log_info "Using existing project: $TEST_PROJECT_ID"
        export TEST_PROJECT_ID
    fi
fi

# Export environment variables for Artillery
export TEST_USER_EMAIL
export TEST_USER_PASSWORD

# Collect baseline metrics before load test
log_info "Collecting baseline metrics..."

# Server memory before test
if command -v ps &> /dev/null; then
    BASELINE_MEMORY=$(ps aux | grep 'node.*server' | grep -v grep | awk '{print $6}' | head -1)
    echo "Baseline Memory: ${BASELINE_MEMORY}KB" > "$RESULTS_DIR/baseline-metrics.txt"
fi

# Database stats
DB_STATS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/health/detailed")
echo "$DB_STATS" > "$RESULTS_DIR/baseline-db-stats.json"

# Redis stats
if echo "$DB_STATS" | grep -q '"redis"'; then
    log_success "Redis is operational"
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}EXECUTING LOAD TEST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

log_info "Test configuration: $ARTILLERY_CONFIG"
log_info "Target: $API_URL"
log_info "Test phases: Warm-up → Ramp-up → Sustained → Spike → Cool-down"

# Run Artillery load test
artillery run \
    --target "$API_URL" \
    --output "$RESULTS_DIR/artillery-report.json" \
    "$ARTILLERY_CONFIG" | tee "$RESULTS_DIR/artillery-output.log"

ARTILLERY_EXIT_CODE=$?

# Generate HTML report
if [ -f "$RESULTS_DIR/artillery-report.json" ]; then
    log_info "Generating HTML report..."
    artillery report "$RESULTS_DIR/artillery-report.json" --output "$RESULTS_DIR/artillery-report.html"
    log_success "HTML report generated: $RESULTS_DIR/artillery-report.html"
fi

# Collect post-test metrics
log_info "Collecting post-test metrics..."

# Server memory after test
if command -v ps &> /dev/null; then
    POSTTEST_MEMORY=$(ps aux | grep 'node.*server' | grep -v grep | awk '{print $6}' | head -1)
    echo "Post-test Memory: ${POSTTEST_MEMORY}KB" >> "$RESULTS_DIR/baseline-metrics.txt"
    
    if [ -n "$BASELINE_MEMORY" ] && [ -n "$POSTTEST_MEMORY" ]; then
        MEMORY_INCREASE=$((POSTTEST_MEMORY - BASELINE_MEMORY))
        echo "Memory Increase: ${MEMORY_INCREASE}KB" >> "$RESULTS_DIR/baseline-metrics.txt"
    fi
fi

# Database stats after test
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/health/detailed" > "$RESULTS_DIR/posttest-db-stats.json"

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PERFORMANCE ANALYSIS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Parse Artillery results
if [ -f "$RESULTS_DIR/artillery-report.json" ]; then
    # Extract key metrics
    TOTAL_REQUESTS=$(grep -o '"counter.http.requests":[0-9]*' "$RESULTS_DIR/artillery-report.json" | cut -d':' -f2 || echo "0")
    TOTAL_RESPONSES=$(grep -o '"counter.http.responses":[0-9]*' "$RESULTS_DIR/artillery-report.json" | cut -d':' -f2 || echo "0")
    HTTP_200=$(grep -o '"counter.http.codes.200":[0-9]*' "$RESULTS_DIR/artillery-report.json" | cut -d':' -f2 || echo "0")
    HTTP_400=$(grep -o '"counter.http.codes.4'  "$RESULTS_DIR/artillery-report.json" | wc -l || echo "0")
    HTTP_500=$(grep -o '"counter.http.codes.5'  "$RESULTS_DIR/artillery-report.json" | wc -l || echo "0")
    
    # Response time metrics (in milliseconds)
    P50=$(grep -o '"http.response_time":{"min":[^}]*' "$RESULTS_DIR/artillery-report.json" | grep -o '"median":[0-9.]*' | cut -d':' -f2 | head -1 || echo "0")
    P95=$(grep -o '"p95":[0-9.]*' "$RESULTS_DIR/artillery-report.json" | cut -d':' -f2 | head -1 || echo "0")
    P99=$(grep -o '"p99":[0-9.]*' "$RESULTS_DIR/artillery-report.json" | cut -d':' -f2 | head -1 || echo "0")
    MAX=$(grep -o '"http.response_time":{"min":[^}]*' "$RESULTS_DIR/artillery-report.json" | grep -o '"max":[0-9.]*' | cut -d':' -f2 | head -1 || echo "0")
    
    # Calculate error rate
    if [ "$TOTAL_RESPONSES" -gt 0 ]; then
        ERROR_COUNT=$((HTTP_400 + HTTP_500))
        ERROR_RATE=$(echo "scale=2; ($ERROR_COUNT * 100) / $TOTAL_RESPONSES" | bc)
    else
        ERROR_RATE="0"
    fi
    
    # Display metrics
    echo -e "${BLUE}Request Metrics:${NC}"
    echo "  Total Requests:   $TOTAL_REQUESTS"
    echo "  Total Responses:  $TOTAL_RESPONSES"
    echo "  HTTP 2xx:         $HTTP_200"
    echo "  HTTP 4xx:         $HTTP_400"
    echo "  HTTP 5xx:         $HTTP_500"
    echo "  Error Rate:       ${ERROR_RATE}%"
    echo ""
    
    echo -e "${BLUE}Response Time (ms):${NC}"
    echo "  p50 (median):     ${P50}ms"
    echo "  p95:              ${P95}ms"
    echo "  p99:              ${P99}ms"
    echo "  Max:              ${MAX}ms"
    echo ""
    
    # Performance assessment
    echo -e "${BLUE}Performance Assessment:${NC}"
    
    PASS_COUNT=0
    WARN_COUNT=0
    FAIL_COUNT=0
    
    # Check p50
    if [ "$(echo "$P50 < 500" | bc)" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} p50 response time: ${P50}ms (target: <500ms)"
        ((PASS_COUNT++))
    elif [ "$(echo "$P50 < 1000" | bc)" -eq 1 ]; then
        echo -e "  ${YELLOW}⚠${NC} p50 response time: ${P50}ms (target: <500ms)"
        ((WARN_COUNT++))
    else
        echo -e "  ${RED}✗${NC} p50 response time: ${P50}ms (target: <500ms)"
        ((FAIL_COUNT++))
    fi
    
    # Check p95
    if [ "$(echo "$P95 < 1000" | bc)" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} p95 response time: ${P95}ms (target: <1000ms)"
        ((PASS_COUNT++))
    elif [ "$(echo "$P95 < 2000" | bc)" -eq 1 ]; then
        echo -e "  ${YELLOW}⚠${NC} p95 response time: ${P95}ms (target: <1000ms)"
        ((WARN_COUNT++))
    else
        echo -e "  ${RED}✗${NC} p95 response time: ${P95}ms (target: <1000ms)"
        ((FAIL_COUNT++))
    fi
    
    # Check p99
    if [ "$(echo "$P99 < 2000" | bc)" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} p99 response time: ${P99}ms (target: <2000ms)"
        ((PASS_COUNT++))
    elif [ "$(echo "$P99 < 3000" | bc)" -eq 1 ]; then
        echo -e "  ${YELLOW}⚠${NC} p99 response time: ${P99}ms (target: <2000ms)"
        ((WARN_COUNT++))
    else
        echo -e "  ${RED}✗${NC} p99 response time: ${P99}ms (target: <2000ms)"
        ((FAIL_COUNT++))
    fi
    
    # Check error rate
    if [ "$(echo "$ERROR_RATE < 1" | bc)" -eq 1 ]; then
        echo -e "  ${GREEN}✓${NC} Error rate: ${ERROR_RATE}% (target: <1%)"
        ((PASS_COUNT++))
    elif [ "$(echo "$ERROR_RATE < 5" | bc)" -eq 1 ]; then
        echo -e "  ${YELLOW}⚠${NC} Error rate: ${ERROR_RATE}% (target: <1%)"
        ((WARN_COUNT++))
    else
        echo -e "  ${RED}✗${NC} Error rate: ${ERROR_RATE}% (target: <1%)"
        ((FAIL_COUNT++))
    fi
    
    echo ""
    
    # Bottleneck identification
    echo -e "${BLUE}Bottleneck Analysis:${NC}"
    
    if [ "$FAIL_COUNT" -gt 0 ]; then
        echo -e "  ${RED}Critical issues detected:${NC}"
        
        if [ "$(echo "$P50 >= 1000" | bc)" -eq 1 ]; then
            echo "    • Median response time too high (database queries?)"
        fi
        
        if [ "$(echo "$P95 >= 2000" | bc)" -eq 1 ]; then
            echo "    • 95th percentile too high (slow endpoints?)"
        fi
        
        if [ "$(echo "$ERROR_RATE >= 5" | bc)" -eq 1 ]; then
            echo "    • High error rate (rate limiting? server capacity?)"
        fi
    elif [ "$WARN_COUNT" -gt 0 ]; then
        echo -e "  ${YELLOW}Areas for optimization:${NC}"
        
        if [ "$(echo "$P50 >= 500" | bc)" -eq 1 ]; then
            echo "    • Consider database indexing"
        fi
        
        if [ "$(echo "$P95 >= 1000" | bc)" -eq 1 ]; then
            echo "    • Optimize slow endpoints"
        fi
        
        if [ "$(echo "$ERROR_RATE >= 1" | bc)" -eq 1 ]; then
            echo "    • Review error logs"
        fi
    else
        echo -e "  ${GREEN}No bottlenecks detected${NC}"
        echo "    • Performance meets production standards"
    fi
    
    echo ""
    
    # Generate detailed report
    cat > "$RESULTS_DIR/performance-report.md" << EOF
# Load Testing Performance Report

**Date:** $(date)  
**Target:** $API_URL  
**Duration:** ~4.5 minutes (warm-up, ramp-up, sustained, spike, cool-down)

## Summary

- **Total Requests:** $TOTAL_REQUESTS
- **Total Responses:** $TOTAL_RESPONSES
- **Error Rate:** ${ERROR_RATE}%
- **Artillery Exit Code:** $ARTILLERY_EXIT_CODE

## Response Time Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| p50 (median) | ${P50}ms | <500ms | $([ "$(echo "$P50 < 500" | bc)" -eq 1 ] && echo "✓ Pass" || echo "⚠ Warn") |
| p95 | ${P95}ms | <1000ms | $([ "$(echo "$P95 < 1000" | bc)" -eq 1 ] && echo "✓ Pass" || echo "⚠ Warn") |
| p99 | ${P99}ms | <2000ms | $([ "$(echo "$P99 < 2000" | bc)" -eq 1 ] && echo "✓ Pass" || echo "⚠ Warn") |
| Max | ${MAX}ms | N/A | - |

## HTTP Status Codes

- **2xx (Success):** $HTTP_200
- **4xx (Client Error):** $HTTP_400
- **5xx (Server Error):** $HTTP_500

## Resource Usage

$(cat "$RESULTS_DIR/baseline-metrics.txt")

## Performance Assessment

- **Passed Checks:** $PASS_COUNT
- **Warnings:** $WARN_COUNT
- **Failed Checks:** $FAIL_COUNT

## Recommendations

$(if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "### Critical - Address Before Production"
    echo "- Investigate slow response times"
    echo "- Review database query performance"
    echo "- Check server capacity"
elif [ "$WARN_COUNT" -gt 0 ]; then
    echo "### Suggested Optimizations"
    echo "- Add database indexes for frequently queried fields"
    echo "- Enable Redis caching for read-heavy operations"
    echo "- Profile slow endpoints"
else
    echo "### Ready for Production"
    echo "- Performance meets all targets"
    echo "- Consider horizontal scaling for additional capacity"
fi)

## Test Configuration

- **Test Phases:**
  - Warm-up: 30s @ 5 users/sec
  - Ramp-up: 60s @ 10→25 users/sec
  - Sustained: 120s @ 25 users/sec
  - Spike: 30s @ 50 users/sec
  - Cool-down: 30s @ 10 users/sec

- **Scenarios:**
  - Authentication (30%)
  - Task Operations (40%)
  - Pull Requests (20%)
  - Chat & Notifications (10%)

## Artifacts

- Raw output: \`artillery-output.log\`
- JSON report: \`artillery-report.json\`
- HTML report: \`artillery-report.html\`
- Database stats: \`baseline-db-stats.json\`, \`posttest-db-stats.json\`

## Next Steps

1. Review HTML report for detailed endpoint analysis
2. $([ "$FAIL_COUNT" -gt 0 ] && echo "Fix performance issues" || echo "Proceed to security penetration testing")
3. Run monitoring validation tests
4. Final staging validation
EOF
    
    log_success "Performance report saved: $RESULTS_DIR/performance-report.md"
    
    # Final verdict
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ "$FAIL_COUNT" -eq 0 ] && [ "$WARN_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✓ LOAD TEST PASSED${NC}"
        echo -e "${GREEN}Performance exceeds production standards${NC}\n"
        exit 0
    elif [ "$FAIL_COUNT" -eq 0 ]; then
        echo -e "${YELLOW}⚠ LOAD TEST PASSED WITH WARNINGS${NC}"
        echo -e "${YELLOW}Consider optimizations before production${NC}\n"
        exit 0
    else
        echo -e "${RED}✗ LOAD TEST FAILED${NC}"
        echo -e "${RED}Fix performance issues before production${NC}\n"
        exit 1
    fi
else
    log_error "Artillery report not generated"
    exit 1
fi
