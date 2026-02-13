#!/bin/bash
#
# User Acceptance Testing (UAT) Script
# Simulates realistic user workflows end-to-end
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
TEST_USER_EMAIL="uat_user_$(date +%s)@example.com"
TEST_USER_PASSWORD="UATTest@123"
TEST_USER_NAME="UAT Test User"

# Test data
INVITED_EMAIL="uat_invited_$(date +%s)@example.com"
PROJECT_NAME="UAT Test Project $(date +%H%M%S)"
TASK_TITLE="UAT Test Task"
PR_TITLE="UAT Test Pull Request"

# Results
RESULTS_DIR="uat-results-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

STEPS_PASSED=0
STEPS_FAILED=0
FRICTION_POINTS=()

log_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}STEP $1: $2${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((STEPS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((STEPS_FAILED++))
}

log_friction() {
    echo -e "${YELLOW}⚠ FRICTION:${NC} $1"
    FRICTION_POINTS+=("$1")
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

measure_time() {
    local start=$1
    local end=$2
    local duration=$((end - start))
    if [ $duration -lt 2 ]; then
        echo "${GREEN}Fast (${duration}s)${NC}"
    elif [ $duration -lt 5 ]; then
        echo "${YELLOW}Acceptable (${duration}s)${NC}"
    else
        echo "${RED}Slow (${duration}s)${NC}"
        log_friction "Operation took ${duration}s (expected < 5s)"
    fi
}

# =================================================================
# USER JOURNEY 1: SIGNUP → VERIFY → LOGIN
# =================================================================

log_step "1" "User Registration Flow"

START_TIME=$(date +%s)

log_info "Registering new user: $TEST_USER_EMAIL"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"$TEST_USER_NAME\",
        \"email\": \"$TEST_USER_EMAIL\",
        \"password\": \"$TEST_USER_PASSWORD\"
    }")

echo "$REGISTER_RESPONSE" > "$RESULTS_DIR/01-register.json"

END_TIME=$(date +%s)
echo -ne "Registration time: "
measure_time $START_TIME $END_TIME

if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    log_pass "User registration successful"
    
    TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        log_pass "JWT token received"
        echo "TOKEN=$TOKEN" > "$RESULTS_DIR/token.txt"
        echo "USER_ID=$USER_ID" > "$RESULTS_DIR/user_id.txt"
    else
        log_fail "JWT token not received"
        exit 1
    fi
    
    # Check if email verification is required
    if echo "$REGISTER_RESPONSE" | grep -q '"isVerified":false'; then
        log_info "Email verification required"
        log_friction "User must verify email before full access"
    elif echo "$REGISTER_RESPONSE" | grep -q '"isVerified":true'; then
        log_pass "User auto-verified (staging mode)"
    fi
else
    log_fail "User registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

# Test login
log_step "2" "User Login Flow"

START_TIME=$(date +%s)

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_USER_EMAIL\",
        \"password\": \"$TEST_USER_PASSWORD\"
    }")

echo "$LOGIN_RESPONSE" > "$RESULTS_DIR/02-login.json"

END_TIME=$(date +%s)
echo -ne "Login time: "
measure_time $START_TIME $END_TIME

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    log_pass "User login successful"
    
    NEW_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    if [ -n "$NEW_TOKEN" ]; then
        TOKEN="$NEW_TOKEN"
        log_pass "Fresh JWT token received on login"
    fi
else
    log_fail "User login failed"
    exit 1
fi

# Verify token works
log_info "Verifying authentication token..."
ME_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/auth/me")
echo "$ME_RESPONSE" > "$RESULTS_DIR/03-auth-me.json"

if echo "$ME_RESPONSE" | grep -q "$TEST_USER_EMAIL"; then
    log_pass "Authentication token valid"
else
    log_fail "Authentication token invalid"
    exit 1
fi

# =================================================================
# USER JOURNEY 2: CREATE PROJECT → INVITE MEMBER
# =================================================================

log_step "3" "Create Project"

START_TIME=$(date +%s)

PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/api/projects" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"$PROJECT_NAME\",
        \"description\": \"UAT test project for validation\"
    }")

echo "$PROJECT_RESPONSE" > "$RESULTS_DIR/04-create-project.json"

END_TIME=$(date +%s)
echo -ne "Project creation time: "
measure_time $START_TIME $END_TIME

if echo "$PROJECT_RESPONSE" | grep -q '"success":true' || echo "$PROJECT_RESPONSE" | grep -q '"_id"'; then
    log_pass "Project created successfully"
    
    PROJECT_ID=$(echo "$PROJECT_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "PROJECT_ID=$PROJECT_ID" > "$RESULTS_DIR/project_id.txt"
    
    if [ -n "$PROJECT_ID" ]; then
        log_pass "Project ID received: $PROJECT_ID"
    else
        log_fail "Project ID not received"
        exit 1
    fi
else
    log_fail "Project creation failed"
    echo "Response: $PROJECT_RESPONSE"
    exit 1
fi

# Invite member to project
log_step "4" "Invite Team Member"

START_TIME=$(date +%s)

INVITE_RESPONSE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/invite" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$INVITED_EMAIL\",
        \"role\": \"developer\"
    }")

echo "$INVITE_RESPONSE" > "$RESULTS_DIR/05-invite-member.json"

END_TIME=$(date +%s)
echo -ne "Invite time: "
measure_time $START_TIME $END_TIME

if echo "$INVITE_RESPONSE" | grep -q '"success":true' || echo "$INVITE_RESPONSE" | grep -q "invited"; then
    log_pass "Team member invited successfully"
    log_info "Invitation email should be sent to $INVITED_EMAIL"
else
    log_fail "Team member invitation failed"
    log_friction "Invitation process unclear or failed"
fi

# =================================================================
# USER JOURNEY 3: CREATE TASK → ASSIGN → UPDATE
# =================================================================

log_step "5" "Task Management Workflow"

START_TIME=$(date +%s)

TASK_RESPONSE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/tasks" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"title\": \"$TASK_TITLE\",
        \"description\": \"UAT test task for workflow validation\",
        \"status\": \"to_do\",
        \"priority\": \"high\",
        \"assignees\": [\"$USER_ID\"]
    }")

echo "$TASK_RESPONSE" > "$RESULTS_DIR/06-create-task.json"

END_TIME=$(date +%s)
echo -ne "Task creation time: "
measure_time $START_TIME $END_TIME

if echo "$TASK_RESPONSE" | grep -q '"success":true' || echo "$TASK_RESPONSE" | grep -q '"_id"'; then
    log_pass "Task created successfully"
    
    TASK_ID=$(echo "$TASK_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "TASK_ID=$TASK_ID" > "$RESULTS_DIR/task_id.txt"
    
    if [ -n "$TASK_ID" ]; then
        log_pass "Task ID received: $TASK_ID"
    else
        log_fail "Task ID not received"
    fi
else
    log_fail "Task creation failed"
    echo "Response: $TASK_RESPONSE"
fi

if [ -n "$TASK_ID" ]; then
    # Update task status
    log_info "Updating task status to in_progress..."
    
    START_TIME=$(date +%s)
    
    UPDATE_RESPONSE=$(curl -s -X PUT "$API_URL/api/projects/$PROJECT_ID/tasks/$TASK_ID" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"status\": \"in_progress\"
        }")
    
    echo "$UPDATE_RESPONSE" > "$RESULTS_DIR/07-update-task.json"
    
    END_TIME=$(date +%s)
    echo -ne "Task update time: "
    measure_time $START_TIME $END_TIME
    
    if echo "$UPDATE_RESPONSE" | grep -q '"success":true' || echo "$UPDATE_RESPONSE" | grep -q '"in_progress"'; then
        log_pass "Task updated successfully"
    else
        log_fail "Task update failed"
    fi
    
    # Add comment to task
    log_info "Adding comment to task..."
    
    COMMENT_RESPONSE=$(curl -s -X POST "$API_URL/api/projects/$PROJECT_ID/tasks/$TASK_ID/comments" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"UAT test comment\"
        }")
    
    echo "$COMMENT_RESPONSE" > "$RESULTS_DIR/08-add-comment.json"
    
    if echo "$COMMENT_RESPONSE" | grep -q '"success":true' || echo "$COMMENT_RESPONSE" | grep -q "comment"; then
        log_pass "Comment added successfully"
    else
        log_fail "Comment addition failed"
    fi
fi

# =================================================================
# USER JOURNEY 4: CREATE PULL REQUEST → LINK TO TASK
# =================================================================

log_step "6" "Pull Request Workflow"

START_TIME=$(date +%s)

PR_RESPONSE=$(curl -s -X POST "$API_URL/api/pull-requests" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"title\": \"$PR_TITLE\",
        \"description\": \"UAT test pull request\",
        \"projectId\": \"$PROJECT_ID\",
        \"sourceBranch\": \"feature/uat-test\",
        \"targetBranch\": \"main\",
        \"linkedTasks\": [\"$TASK_ID\"]
    }")

echo "$PR_RESPONSE" > "$RESULTS_DIR/09-create-pr.json"

END_TIME=$(date +%s)
echo -ne "PR creation time: "
measure_time $START_TIME $END_TIME

if echo "$PR_RESPONSE" | grep -q '"success":true' || echo "$PR_RESPONSE" | grep -q '"_id"'; then
    log_pass "Pull request created successfully"
    
    PR_ID=$(echo "$PR_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    echo "PR_ID=$PR_ID" > "$RESULTS_DIR/pr_id.txt"
    
    if [ -n "$PR_ID" ]; then
        log_pass "PR ID received: $PR_ID"
        
        # Add review to PR
        log_info "Adding review to pull request..."
        
        REVIEW_RESPONSE=$(curl -s -X POST "$API_URL/api/pull-requests/$PR_ID/review" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"status\": \"approved\",
                \"comment\": \"UAT test approval\"
            }")
        
        echo "$REVIEW_RESPONSE" > "$RESULTS_DIR/10-pr-review.json"
        
        if echo "$REVIEW_RESPONSE" | grep -q '"success":true' || echo "$REVIEW_RESPONSE" | grep -q "approved"; then
            log_pass "PR review added successfully"
        else
            log_fail "PR review failed"
        fi
    fi
else
    log_fail "Pull request creation failed"
    echo "Response: $PR_RESPONSE"
fi

# =================================================================
# USER JOURNEY 5: FILE UPLOAD → ATTACH TO TASK
# =================================================================

log_step "7" "File Attachment Workflow"

# Create test file
echo "UAT Test File Content - $(date)" > "$RESULTS_DIR/test-file.txt"

START_TIME=$(date +%s)

UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/api/files/upload" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$RESULTS_DIR/test-file.txt")

echo "$UPLOAD_RESPONSE" > "$RESULTS_DIR/11-file-upload.json"

END_TIME=$(date +%s)
echo -ne "File upload time: "
measure_time $START_TIME $END_TIME

if echo "$UPLOAD_RESPONSE" | grep -q '"success":true' || echo "$UPLOAD_RESPONSE" | grep -q "url"; then
    log_pass "File uploaded successfully"
    
    FILE_ID=$(echo "$UPLOAD_RESPONSE" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ -n "$FILE_ID" ] && [ -n "$TASK_ID" ]; then
        log_info "Attaching file to task..."
        
        ATTACH_RESPONSE=$(curl -s -X POST "$API_URL/api/tasks/$TASK_ID/attach-file" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "{
                \"fileId\": \"$FILE_ID\"
            }")
        
        echo "$ATTACH_RESPONSE" > "$RESULTS_DIR/12-attach-file.json"
        
        if echo "$ATTACH_RESPONSE" | grep -q '"success":true'; then
            log_pass "File attached to task successfully"
        else
            log_fail "File attachment failed"
        fi
    fi
else
    log_fail "File upload failed"
    echo "Response: $UPLOAD_RESPONSE"
fi

# =================================================================
# USER JOURNEY 6: NOTIFICATIONS
# =================================================================

log_step "8" "Notification System"

log_info "Checking notifications..."

NOTIF_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/notifications")
echo "$NOTIF_RESPONSE" > "$RESULTS_DIR/13-notifications.json"

if echo "$NOTIF_RESPONSE" | grep -q '"success":true' || echo "$NOTIF_RESPONSE" | grep -q "notifications"; then
    log_pass "Notifications endpoint works"
    
    NOTIF_COUNT=$(echo "$NOTIF_RESPONSE" | grep -o '"_id"' | wc -l)
    log_info "Found $NOTIF_COUNT notification(s)"
    
    if [ "$NOTIF_COUNT" -gt 0 ]; then
        log_pass "Notifications are being created"
    else
        log_friction "No notifications created during workflow (expected some)"
    fi
else
    log_fail "Notifications endpoint failed"
fi

# =================================================================
# USER JOURNEY 7: PROJECT ANALYTICS
# =================================================================

log_step "9" "Analytics & Insights"

log_info "Fetching project analytics..."

if [ -n "$PROJECT_ID" ]; then
    ANALYTICS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/api/tasks/$PROJECT_ID/analytics")
    echo "$ANALYTICS_RESPONSE" > "$RESULTS_DIR/14-analytics.json"
    
    if echo "$ANALYTICS_RESPONSE" | grep -q '"success":true' || echo "$ANALYTICS_RESPONSE" | grep -q "tasks"; then
        log_pass "Analytics endpoint works"
    else
        log_fail "Analytics endpoint failed"
    fi
fi

# =================================================================
# SUMMARY & FRICTION REPORT
# =================================================================

log_step "10" "UAT Summary"

TOTAL_STEPS=$((STEPS_PASSED + STEPS_FAILED))
PASS_RATE=$((STEPS_PASSED * 100 / TOTAL_STEPS))

echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}USER ACCEPTANCE TEST RESULTS${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

echo -e "${GREEN}Steps Passed:${NC}  $STEPS_PASSED"
echo -e "${RED}Steps Failed:${NC}  $STEPS_FAILED"
echo -e "Total Steps:   $TOTAL_STEPS"
echo -e "Success Rate:  ${PASS_RATE}%\n"

# Friction points report
if [ ${#FRICTION_POINTS[@]} -gt 0 ]; then
    echo -e "${YELLOW}FRICTION POINTS IDENTIFIED:${NC}\n"
    for i in "${!FRICTION_POINTS[@]}"; do
        echo -e "  $((i+1)). ${FRICTION_POINTS[$i]}"
    done
    echo ""
fi

# Write detailed report
cat > "$RESULTS_DIR/uat-report.md" << EOF
# User Acceptance Testing Report

**Date:** $(date)  
**Environment:** $API_URL  
**Test User:** $TEST_USER_EMAIL

## Summary

- **Steps Passed:** $STEPS_PASSED
- **Steps Failed:** $STEPS_FAILED
- **Success Rate:** ${PASS_RATE}%

## User Journeys Tested

1. ✓ User Registration & Login
2. ✓ Project Creation & Team Invitations
3. ✓ Task Management (Create, Update, Comment)
4. ✓ Pull Request Workflow
5. ✓ File Upload & Attachment
6. ✓ Notifications
7. ✓ Analytics & Insights

## Friction Points

$(if [ ${#FRICTION_POINTS[@]} -gt 0 ]; then
    for i in "${!FRICTION_POINTS[@]}"; do
        echo "$((i+1)). ${FRICTION_POINTS[$i]}"
    done
else
    echo "None identified"
fi)

## Test Artifacts

All API responses saved to: $RESULTS_DIR/

## Recommendations

$(if [ "$PASS_RATE" -ge 90 ]; then
    echo "✅ User experience is smooth. Ready for load testing."
elif [ "$PASS_RATE" -ge 80 ]; then
    echo "⚠️ Address friction points before production launch."
else
    echo "❌ Significant UX issues. Fix failed steps before proceeding."
fi)

## Next Steps

1. Review friction points and optimize
2. Conduct load testing
3. Perform security penetration testing
4. Final staging validation
EOF

echo -e "📝 Detailed report saved to: ${BLUE}$RESULTS_DIR/uat-report.md${NC}\n"

# Final verdict
if [ "$STEPS_FAILED" -eq 0 ] && [ "$PASS_RATE" -ge 90 ]; then
    echo -e "${GREEN}✓ USER ACCEPTANCE TESTING PASSED${NC}"
    echo -e "${GREEN}User workflows are smooth and functional${NC}\n"
    exit 0
elif [ "$STEPS_FAILED" -le 2 ] && [ "$PASS_RATE" -ge 80 ]; then
    echo -e "${YELLOW}⚠ USER ACCEPTANCE TESTING MOSTLY PASSED${NC}"
    echo -e "${YELLOW}Address ${#FRICTION_POINTS[@]} friction point(s) before launch${NC}\n"
    exit 0
else
    echo -e "${RED}✗ USER ACCEPTANCE TESTING FAILED${NC}"
    echo -e "${RED}Fix $STEPS_FAILED critical issue(s)${NC}\n"
    exit 1
fi
