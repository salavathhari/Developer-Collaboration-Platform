#!/bin/bash
#
# Backup & Restore Validation Script
# Tests: Backup creation, restoration, data integrity
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
DB_NAME="${DB_NAME:-developerplatform}"
BACKUP_SCRIPT="${BACKUP_SCRIPT:-./server/scripts/backup-mongodb.sh}"
RESTORE_SCRIPT="${RESTORE_SCRIPT:-./server/scripts/restore-mongodb.sh}"
BACKUP_DIR="${BACKUP_DIR:-./server/backups}"

# Results
RESULTS_DIR="backup-validation-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

TESTS_PASSED=0
TESTS_FAILED=0

log_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}BACKUP & RESTORE VALIDATION${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

# =================================================================
# PRE-FLIGHT CHECKS
# =================================================================

log_step "PRE-FLIGHT CHECKS"

# Check if MongoDB is accessible
if mongosh --version &> /dev/null || mongo --version &> /dev/null; then
    log_pass "MongoDB client available"
    MONGO_CMD="mongosh"
    
    # Fallback to legacy mongo client
    if ! mongosh --version &> /dev/null; then
        MONGO_CMD="mongo"
    fi
else
    log_fail "MongoDB client not installed (mongosh or mongo required)"
    exit 1
fi

# Check if backup script exists
if [ -f "$BACKUP_SCRIPT" ]; then
    log_pass "Backup script found: $BACKUP_SCRIPT"
else
    log_fail "Backup script not found: $BACKUP_SCRIPT"
    exit 1
fi

# Check if restore script exists
if [ -f "$RESTORE_SCRIPT" ]; then
    log_pass "Restore script found: $RESTORE_SCRIPT"
else
    log_fail "Restore script not found: $RESTORE_SCRIPT"
    exit 1
fi

# Test MongoDB connection
if $MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "db.runCommand({ ping: 1 })" &> /dev/null; then
    log_pass "MongoDB connection successful"
else
    log_fail "Cannot connect to MongoDB at $MONGO_URI"
    exit 1
fi

# =================================================================
# CREATE TEST DATA
# =================================================================

log_step "CREATING TEST DATA FOR VALIDATION"

TEST_COLLECTION="backup_test_$(date +%s)"
TEST_DOC_ID="test_doc_$(date +%s)"
TEST_VALUE="backup_validation_$(openssl rand -hex 8 2>/dev/null || echo "test_value")"

log_info "Creating test document in collection: $TEST_COLLECTION"

$MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.insertOne({
        _id: '$TEST_DOC_ID',
        testValue: '$TEST_VALUE',
        createdAt: new Date(),
        metadata: {
            purpose: 'backup_validation',
            timestamp: $(date +%s)
        }
    })
" > /dev/null

# Verify test data
VERIFY_RESULT=$($MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.findOne({ _id: '$TEST_DOC_ID' })
" | grep "$TEST_VALUE" || echo "")

if [ -n "$VERIFY_RESULT" ]; then
    log_pass "Test data created successfully"
    echo "Test Collection: $TEST_COLLECTION" > "$RESULTS_DIR/test-data.txt"
    echo "Test Document ID: $TEST_DOC_ID" >> "$RESULTS_DIR/test-data.txt"
    echo "Test Value: $TEST_VALUE" >> "$RESULTS_DIR/test-data.txt"
else
    log_fail "Failed to create test data"
    exit 1
fi

# =================================================================
# EXECUTE BACKUP
# =================================================================

log_step "EXECUTING BACKUP"

log_info "Running backup script..."

BACKUP_START=$(date +%s)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Run backup (suppress interactive prompts)
if bash "$BACKUP_SCRIPT" &> "$RESULTS_DIR/backup-output.log"; then
    BACKUP_END=$(date +%s)
    BACKUP_DURATION=$((BACKUP_END - BACKUP_START))
    
    log_pass "Backup completed in ${BACKUP_DURATION}s"
    
    # Find the most recent backup
    if [ -d "$BACKUP_DIR" ]; then
        LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.gz 2>/dev/null | head -1 || ls -t "$BACKUP_DIR"/*/ 2>/dev/null | head -1)
        
        if [ -n "$LATEST_BACKUP" ]; then
            log_pass "Backup file found: $LATEST_BACKUP"
            
            BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
            log_info "Backup size: $BACKUP_SIZE"
            
            echo "Backup File: $LATEST_BACKUP" > "$RESULTS_DIR/backup-info.txt"
            echo "Backup Size: $BACKUP_SIZE" >> "$RESULTS_DIR/backup-info.txt"
            echo "Backup Duration: ${BACKUP_DURATION}s" >> "$RESULTS_DIR/backup-info.txt"
        else
            log_fail "Backup file not found in $BACKUP_DIR"
        fi
    else
        log_fail "Backup directory not found: $BACKUP_DIR"
    fi
else
    log_fail "Backup script failed"
    cat "$RESULTS_DIR/backup-output.log"
    exit 1
fi

# =================================================================
# SIMULATE DATA LOSS
# =================================================================

log_step "SIMULATING DATA LOSS"

log_info "Dropping test collection to simulate data loss..."

$MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.drop()
" > /dev/null

# Verify data is gone
VERIFY_DROPPED=$($MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.findOne({ _id: '$TEST_DOC_ID' })
" | grep "null" || echo "still_exists")

if echo "$VERIFY_DROPPED" | grep -q "null"; then
    log_pass "Test data successfully deleted (simulating data loss)"
else
    log_fail "Failed to drop test collection"
    exit 1
fi

# =================================================================
# RESTORE FROM BACKUP
# =================================================================

log_step "RESTORING FROM BACKUP"

if [ -n "$LATEST_BACKUP" ]; then
    log_info "Restoring from backup: $LATEST_BACKUP"
    
    RESTORE_START=$(date +%s)
    
    # Extract backup if it's compressed
    if [[ "$LATEST_BACKUP" == *.gz ]]; then
        log_info "Extracting compressed backup..."
        EXTRACT_DIR="$RESULTS_DIR/restore_extract"
        mkdir -p "$EXTRACT_DIR"
        
        tar -xzf "$LATEST_BACKUP" -C "$EXTRACT_DIR" 2>/dev/null || gunzip -c "$LATEST_BACKUP" > "$EXTRACT_DIR/backup.archive"
        
        # Find the extracted directory
        BACKUP_PATH=$(find "$EXTRACT_DIR" -type d -name "$DB_NAME" | head -1)
        
        if [ -z "$BACKUP_PATH" ]; then
            # Try finding any directory with BSON files
            BACKUP_PATH=$(find "$EXTRACT_DIR" -name "*.bson" -exec dirname {} \; | head -1)
        fi
    else
        BACKUP_PATH="$LATEST_BACKUP"
    fi
    
    if [ -n "$BACKUP_PATH" ] && [ -d "$BACKUP_PATH" ]; then
        log_info "Restoring from: $BACKUP_PATH"
        
        # Use mongorestore
        if mongorestore --uri="$MONGO_URI" --db="$DB_NAME" "$BACKUP_PATH" &> "$RESULTS_DIR/restore-output.log"; then
            RESTORE_END=$(date +%s)
            RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
            
            log_pass "Restore completed in ${RESTORE_DURATION}s"
            
            echo "Restore Duration: ${RESTORE_DURATION}s" >> "$RESULTS_DIR/backup-info.txt"
        else
            log_fail "mongorestore failed"
            cat "$RESULTS_DIR/restore-output.log"
            exit 1
        fi
    else
        log_fail "Could not find backup data to restore"
        exit 1
    fi
else
    log_fail "No backup file available for restore test"
    exit 1
fi

# =================================================================
# VERIFY DATA INTEGRITY
# =================================================================

log_step "VERIFYING DATA INTEGRITY"

log_info "Checking if test data was restored..."

# Wait a moment for restore to complete
sleep 2

RESTORED_DATA=$($MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.findOne({ _id: '$TEST_DOC_ID' })
")

echo "$RESTORED_DATA" > "$RESULTS_DIR/restored-data.txt"

if echo "$RESTORED_DATA" | grep -q "$TEST_VALUE"; then
    log_pass "Test data successfully restored"
    log_pass "Data integrity verified: testValue matches"
else
    log_fail "Test data not found after restore"
    log_info "Check $RESULTS_DIR/restored-data.txt for details"
fi

# Check document count
DOC_COUNT=$($MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.countDocuments({})
")

if [ "$DOC_COUNT" -gt 0 ]; then
    log_pass "Collection has $DOC_COUNT document(s) after restore"
else
    log_fail "Collection is empty after restore"
fi

# =================================================================
# CLEANUP
# =================================================================

log_step "CLEANUP"

log_info "Removing test collection..."

$MONGO_CMD "$MONGO_URI/$DB_NAME" --quiet --eval "
    db.$TEST_COLLECTION.drop()
" > /dev/null

log_pass "Test collection cleaned up"

# Clean up extraction directory
if [ -d "$RESULTS_DIR/restore_extract" ]; then
    rm -rf "$RESULTS_DIR/restore_extract"
    log_info "Temporary files cleaned up"
fi

# =================================================================
# BACKUP STRATEGY VALIDATION
# =================================================================

log_step "BACKUP STRATEGY VALIDATION"

# Check for backup retention policy
if grep -q "RETENTION_DAYS" "$BACKUP_SCRIPT"; then
    log_pass "Retention policy configured in backup script"
else
    log_info "No explicit retention policy found"
fi

# Check for S3 backup (optional)
if grep -q "aws s3" "$BACKUP_SCRIPT" || grep -q "S3_BUCKET" "$BACKUP_SCRIPT"; then
    log_pass "Remote backup to S3 configured"
else
    log_info "No remote backup configured (recommended for production)"
fi

# Check backup schedule
if [ -f "/etc/crontab" ] && grep -q "backup-mongodb" "/etc/crontab"; then
    log_pass "Backup scheduled via cron"
elif command -v crontab &> /dev/null && crontab -l 2>/dev/null | grep -q "backup-mongodb"; then
    log_pass "Backup scheduled via user crontab"
else
    log_info "No automated backup schedule detected"
    log_info "Recommendation: Schedule daily backups via cron"
fi

# =================================================================
# SUMMARY
# =================================================================

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$((TESTS_PASSED * 100 / TOTAL_TESTS))

echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}BACKUP VALIDATION SUMMARY${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

echo -e "${GREEN}Tests Passed:${NC}  $TESTS_PASSED"
echo -e "${RED}Tests Failed:${NC}  $TESTS_FAILED"
echo -e "Total Tests:   $TOTAL_TESTS"
echo -e "Success Rate:  ${SUCCESS_RATE}%\n"

# Generate report
cat > "$RESULTS_DIR/backup-validation-report.md" << EOF
# Backup & Restore Validation Report

**Date:** $(date)  
**Database:** $DB_NAME  
**MongoDB URI:** $MONGO_URI

## Summary

- **Tests Passed:** $TESTS_PASSED
- **Tests Failed:** $TESTS_FAILED
- **Success Rate:** ${SUCCESS_RATE}%

## Test Results

### 1. Backup Creation
- Status: $([ -n "$LATEST_BACKUP" ] && echo "✅ Success" || echo "❌ Failed")
- Duration: ${BACKUP_DURATION}s
- Size: ${BACKUP_SIZE:-N/A}

### 2. Data Loss Simulation
- Status: ✅ Verified

### 3. Restore Process
- Status: $([ -n "$RESTORE_DURATION" ] && echo "✅ Success" || echo "❌ Failed")
- Duration: ${RESTORE_DURATION:-N/A}s

### 4. Data Integrity
- Status: $(echo "$RESTORED_DATA" | grep -q "$TEST_VALUE" && echo "✅ Verified" || echo "❌ Failed")
- Test value matched: $(echo "$RESTORED_DATA" | grep -q "$TEST_VALUE" && echo "Yes" || echo "No")

### 5. Backup Strategy
- Retention policy: $(grep -q "RETENTION_DAYS" "$BACKUP_SCRIPT" && echo "✅ Configured" || echo "⚠️ Not found")
- Remote backup: $(grep -q "S3_BUCKET" "$BACKUP_SCRIPT" && echo "✅ S3 enabled" || echo "⚠️ Not configured")
- Automated schedule: $(crontab -l 2>/dev/null | grep -q "backup" && echo "✅ Scheduled" || echo "⚠️ Manual only")

## Backup Details

$(cat "$RESULTS_DIR/backup-info.txt" 2>/dev/null || echo "Backup info not available")

## Recommendations

$(if [ "$TESTS_FAILED" -eq 0 ]; then
    echo "✅ **Backup & restore process is production-ready**"
    echo ""
    echo "Best practices to ensure:"
    echo "- Schedule automated daily backups (cron job)"
    echo "- Configure remote backup to S3 or cloud storage"
    echo "- Test restores quarterly"
    echo "- Monitor backup failures (alerts)"
    echo "- Document restore procedures"
else
    echo "⚠️ **Address backup issues before production**"
    echo ""
    [ ! -f "$BACKUP_SCRIPT" ] && echo "- Create backup script"
    [ -z "$LATEST_BACKUP" ] && echo "- Fix backup creation process"
    [ -z "$RESTORE_DURATION" ] && echo "- Verify restore process"
    echo ""
    echo "Critical: Regular backups are essential for production systems"
fi)

## Recovery Time Objective (RTO)

- **Backup Duration:** ${BACKUP_DURATION}s (~$((BACKUP_DURATION / 60)) minutes)
- **Restore Duration:** ${RESTORE_DURATION:-N/A}s (~$((${RESTORE_DURATION:-0} / 60)) minutes)
- **Total RTO:** ~$((${BACKUP_DURATION} + ${RESTORE_DURATION:-0})) seconds

For production:
- Target RTO: < 1 hour
- Current RTO: $([ "$((${BACKUP_DURATION} + ${RESTORE_DURATION:-0}))" -lt 3600 ] && echo "✅ Meets target" || echo "⚠️ Exceeds target")

## Next Steps

1. $([ "$TESTS_FAILED" -eq 0 ] && echo "Backup validation passed - proceed to final checklist" || echo "Fix backup issues")
2. Set up automated backup schedule (if not already done)
3. Configure S3 remote backups for disaster recovery
4. Create runbook for restore procedures
5. Schedule quarterly restore drills

## Artifacts

- Test data: \`$RESULTS_DIR/test-data.txt\`
- Backup output: \`$RESULTS_DIR/backup-output.log\`
- Restore output: \`$RESULTS_DIR/restore-output.log\`
- Restored data: \`$RESULTS_DIR/restored-data.txt\`
EOF

log_info "Report saved: $RESULTS_DIR/backup-validation-report.md"

# Final verdict
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$TESTS_FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ BACKUP VALIDATION PASSED${NC}"
    echo -e "${GREEN}Backup & restore process is reliable${NC}\n"
    exit 0
else
    echo -e "${RED}✗ BACKUP VALIDATION FAILED${NC}"
    echo -e "${RED}Fix backup/restore issues before production${NC}\n"
    exit 1
fi
