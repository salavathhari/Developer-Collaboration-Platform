#!/bin/bash
#
# Master Pre-Launch Validation Runner
# Orchestrates all validation tests before production deployment
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Results directory
MASTER_RESULTS_DIR="pre-launch-validation-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$MASTER_RESULTS_DIR"

# Test Results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Configuration
RUN_STAGING=${RUN_STAGING:-true}
RUN_UAT=${RUN_UAT:-true}
RUN_LOAD=${RUN_LOAD:-true}
RUN_MONITORING=${RUN_MONITORING:-true}
RUN_SECURITY=${RUN_SECURITY:-true}
RUN_BACKUP=${RUN_BACKUP:-true}
RUN_CHECKLIST=${RUN_CHECKLIST:-true}

log_header() {
    echo -e "\n${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}║     PRE-LAUNCH VALIDATION SUITE                          ║${NC}"
    echo -e "${CYAN}║     Comprehensive Production Readiness Testing           ║${NC}"
    echo -e "${CYAN}║                                                           ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}\n"
}

log_phase() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}PHASE $1: $2${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_success() {
    echo -e "${GREEN}✓ SUCCESS:${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}✗ FAILED:${NC} $1"
    ((TESTS_FAILED++))
}

log_skip() {
    echo -e "${YELLOW}⊘ SKIPPED:${NC} $1"
    ((TESTS_SKIPPED++))
}

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

run_test() {
    local phase_num=$1
    local phase_name=$2
    local script_path=$3
    local enabled=$4
    
    log_phase "$phase_num" "$phase_name"
    
    if [ "$enabled" = "false" ]; then
        log_skip "$phase_name (disabled)"
        return 0
    fi
    
    if [ ! -f "$script_path" ]; then
        log_fail "$phase_name - script not found: $script_path"
        return 1
    fi
    
    log_info "Running: $script_path"
    
    START_TIME=$(date +%s)
    
    if bash "$script_path" > "$MASTER_RESULTS_DIR/phase${phase_num}-${phase_name// /-}.log" 2>&1; then
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        
        log_success "$phase_name completed in ${DURATION}s"
        
        echo "$phase_name: PASSED (${DURATION}s)" >> "$MASTER_RESULTS_DIR/summary.txt"
        return 0
    else
        END_TIME=$(date +%s)
        DURATION=$((END_TIME - START_TIME))
        
        log_fail "$phase_name failed after ${DURATION}s"
        log_info "Check logs: $MASTER_RESULTS_DIR/phase${phase_num}-${phase_name// /-}.log"
        
        echo "$phase_name: FAILED (${DURATION}s)" >> "$MASTER_RESULTS_DIR/summary.txt"
        return 1
    fi
}

# =================================================================
# BANNER
# =================================================================

log_header

log_info "Validation Suite Started: $(date)"
log_info "Results Directory: $MASTER_RESULTS_DIR"
log_info ""
log_info "Test Configuration:"
log_info "  - Staging Validation: $RUN_STAGING"
log_info "  - UAT Testing: $RUN_UAT"
log_info "  - Load Testing: $RUN_LOAD"
log_info "  - Monitoring Validation: $RUN_MONITORING"
log_info "  - Security Testing: $RUN_SECURITY"
log_info "  - Backup Validation: $RUN_BACKUP"
log_info "  - Final Checklist: $RUN_CHECKLIST"

echo ""
read -p "Press Enter to continue or Ctrl+C to abort..."

# =================================================================
# PHASE 1: STAGING DEPLOYMENT VALIDATION
# =================================================================

run_test 1 "Staging Deployment Validation" \
    "./scripts/staging-validation.sh" \
    "$RUN_STAGING" || true

# =================================================================
# PHASE 2: USER ACCEPTANCE TESTING
# =================================================================

run_test 2 "User Acceptance Testing" \
    "./scripts/uat-testing.sh" \
    "$RUN_UAT" || true

# =================================================================
# PHASE 3: LOAD TESTING & PERFORMANCE
# =================================================================

if [ "$RUN_LOAD" = "true" ]; then
    log_phase 3 "Load Testing & Performance Analysis"
    
    log_info "Load testing requires Artillery CLI"
    
    if command -v artillery &> /dev/null; then
        log_info "Artillery found, proceeding..."
        
        run_test 3 "Load Testing" \
            "./scripts/load-test-execution.sh" \
            "$RUN_LOAD" || true
    else
        log_skip "Load Testing (Artillery not installed: npm install -g artillery)"
        ((TESTS_SKIPPED++))
    fi
else
    log_skip "Load Testing (disabled)"
    ((TESTS_SKIPPED++))
fi

# =================================================================
# PHASE 4: MONITORING & OBSERVABILITY
# =================================================================

run_test 4 "Monitoring Validation" \
    "./scripts/monitoring-validation.sh" \
    "$RUN_MONITORING" || true

# =================================================================
# PHASE 5: SECURITY PENETRATION TESTING
# =================================================================

run_test 5 "Security Penetration Testing" \
    "./scripts/security-penetration-test.sh" \
    "$RUN_SECURITY" || true

# =================================================================
# PHASE 6: BACKUP & RESTORE VALIDATION
# =================================================================

if [ "$RUN_BACKUP" = "true" ]; then
    log_phase 6 "Backup & Restore Validation"
    
    log_info "Backup testing requires MongoDB client (mongosh/mongo)"
    
    if mongosh --version &> /dev/null || mongo --version &> /dev/null; then
        log_info "MongoDB client found, proceeding..."
        
        run_test 6 "Backup Restore Validation" \
            "./scripts/backup-restore-validation.sh" \
            "$RUN_BACKUP" || true
    else
        log_skip "Backup Validation (MongoDB client not installed)"
        ((TESTS_SKIPPED++))
    fi
else
    log_skip "Backup Validation (disabled)"
    ((TESTS_SKIPPED++))
fi

# =================================================================
# PHASE 7: FINAL LAUNCH CHECKLIST
# =================================================================

run_test 7 "Final Launch Checklist" \
    "./scripts/final-launch-checklist.sh" \
    "$RUN_CHECKLIST" || true

# =================================================================
# AGGREGATE RESULTS
# =================================================================

echo -e "\n${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║     VALIDATION SUITE COMPLETE                            ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}\n"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))

echo -e "${GREEN}Tests Passed:${NC}  $TESTS_PASSED"
echo -e "${RED}Tests Failed:${NC}  $TESTS_FAILED"
echo -e "${YELLOW}Tests Skipped:${NC} $TESTS_SKIPPED"
echo -e "Total Tests:   $TOTAL_TESTS"

if [ "$TOTAL_TESTS" -gt 0 ]; then
    SUCCESS_RATE=$(( (TESTS_PASSED * 100) / (TESTS_PASSED + TESTS_FAILED) ))
    echo -e "Success Rate:  ${SUCCESS_RATE}%\n"
fi

# Generate master report
cat > "$MASTER_RESULTS_DIR/VALIDATION_REPORT.md" << EOF
# Pre-Launch Validation Report

**Date:** $(date)  
**Validation Suite Version:** 1.0

## Executive Summary

- **Tests Passed:** $TESTS_PASSED
- **Tests Failed:** $TESTS_FAILED
- **Tests Skipped:** $TESTS_SKIPPED
- **Success Rate:** ${SUCCESS_RATE:-N/A}%

## Test Phases

$(cat "$MASTER_RESULTS_DIR/summary.txt" 2>/dev/null || echo "No phase results")

## Launch Readiness

$(if [ "$TESTS_FAILED" -eq 0 ] && [ "$TESTS_PASSED" -ge 5 ]; then
    echo "### ✅ READY FOR PRODUCTION LAUNCH"
    echo ""
    echo "All critical validation tests passed."
    echo ""
    echo "**Recommendations:**"
    echo "- Final review of logs"
    echo "- Coordinate launch timing with team"
    echo "- Prepare rollback plan"
    echo "- Monitor first 24h closely"
elif [ "$TESTS_FAILED" -le 2 ] && [ "$TESTS_PASSED" -ge 4 ]; then
    echo "### ⚠️ CONDITIONAL GO"
    echo ""
    echo "Most tests passed, but $TESTS_FAILED test(s) failed."
    echo ""
    echo "**Action Required:**"
    echo "- Review failed test logs"
    echo "- Assess risk of proceeding with failures"
    echo "- Consider fixing critical issues before launch"
else
    echo "### ❌ NOT READY FOR PRODUCTION"
    echo ""
    echo "**$TESTS_FAILED critical test(s) failed.**"
    echo ""
    echo "**Action Required:**"
    echo "- Fix failing tests"
    echo "- Re-run validation suite"
    echo "- Do NOT proceed to production until all pass"
fi)

## Detailed Results

### Phase 1: Staging Deployment Validation
$([ -f "$MASTER_RESULTS_DIR/phase1-Staging-Deployment-Validation.log" ] && echo "✅ See: \`phase1-Staging-Deployment-Validation.log\`" || echo "⊘ Skipped or not run")

### Phase 2: User Acceptance Testing
$([ -f "$MASTER_RESULTS_DIR/phase2-User-Acceptance-Testing.log" ] && echo "✅ See: \`phase2-User-Acceptance-Testing.log\`" || echo "⊘ Skipped or not run")

### Phase 3: Load Testing & Performance
$([ -f "$MASTER_RESULTS_DIR/phase3-Load-Testing.log" ] && echo "✅ See: \`phase3-Load-Testing.log\`" || echo "⊘ Skipped or not run")

### Phase 4: Monitoring Validation
$([ -f "$MASTER_RESULTS_DIR/phase4-Monitoring-Validation.log" ] && echo "✅ See: \`phase4-Monitoring-Validation.log\`" || echo "⊘ Skipped or not run")

### Phase 5: Security Penetration Testing
$([ -f "$MASTER_RESULTS_DIR/phase5-Security-Penetration-Testing.log" ] && echo "✅ See: \`phase5-Security-Penetration-Testing.log\`" || echo "⊘ Skipped or not run")

### Phase 6: Backup & Restore Validation
$([ -f "$MASTER_RESULTS_DIR/phase6-Backup-Restore-Validation.log" ] && echo "✅ See: \`phase6-Backup-Restore-Validation.log\`" || echo "⊘ Skipped or not run")

### Phase 7: Final Launch Checklist
$([ -f "$MASTER_RESULTS_DIR/phase7-Final-Launch-Checklist.log" ] && echo "✅ See: \`phase7-Final-Launch-Checklist.log\`" || echo "⊘ Skipped or not run")

## Artifacts

All test logs and detailed reports are available in:
\`\`\`
$MASTER_RESULTS_DIR/
\`\`\`

## Next Steps

$(if [ "$TESTS_FAILED" -eq 0 ]; then
    echo "1. ✅ Review all logs for warnings"
    echo "2. ✅ Prepare production deployment"
    echo "3. ✅ Schedule launch window"
    echo "4. ✅ Brief team on monitoring procedures"
    echo "5. ✅ Execute deployment"
else
    echo "1. ❌ Review failed test logs immediately"
    echo "2. ❌ Fix identified issues"
    echo "3. ❌ Re-run validation suite"
    echo "4. ❌ Do not proceed until all tests pass"
fi)

---

**Generated by:** Pre-Launch Validation Suite  
**Report Location:** \`$MASTER_RESULTS_DIR/VALIDATION_REPORT.md\`
EOF

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Master validation report saved:${NC}"
echo -e "${CYAN}$MASTER_RESULTS_DIR/VALIDATION_REPORT.md${NC}\n"

# Copy individual reports to master directory
log_info "Aggregating individual test reports..."

for report in validation-results*/summary.txt \
               uat-results*/uat-report.md \
               load-test-results*/performance-report.md \
               monitoring-validation*/monitoring-report.md \
               security-test*/security-report.md \
               backup-validation*/backup-validation-report.md \
               launch-checklist*/launch-readiness-report.md; do
    if [ -f "$report" ]; then
        cp "$report" "$MASTER_RESULTS_DIR/" 2>/dev/null || true
    fi
done

log_info "Individual reports copied to $MASTER_RESULTS_DIR/"

# Final verdict
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$TESTS_FAILED" -eq 0 ] && [ "$TESTS_PASSED" -ge 5 ]; then
    echo -e "${GREEN}✅ VALIDATION SUITE PASSED${NC}"
    echo -e "${GREEN}Platform is ready for production deployment!${NC}\n"
    exit 0
elif [ "$TESTS_FAILED" -le 2 ]; then
    echo -e "${YELLOW}⚠️  VALIDATION SUITE: CONDITIONAL PASS${NC}"
    echo -e "${YELLOW}Review $TESTS_FAILED failed test(s) before proceeding${NC}\n"
    exit 0
else
    echo -e "${RED}❌ VALIDATION SUITE FAILED${NC}"
    echo -e "${RED}Fix $TESTS_FAILED test(s) before production deployment${NC}\n"
    exit 1
fi
