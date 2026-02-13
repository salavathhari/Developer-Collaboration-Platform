#!/bin/bash
#
# MongoDB Backup Script
# Creates compressed backups with timestamp and manages retention
#

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongodb}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
MONGO_DB="${MONGO_DB:-devplatform}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PATH="${S3_PATH:-mongodb-backups}"

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="mongodb_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if mongodump is available
if ! command -v mongodump &> /dev/null; then
    log_error "mongodump not found. Install MongoDB Database Tools."
    exit 1
fi

# Create backup directory
mkdir -p "${BACKUP_DIR}"

log_info "Starting MongoDB backup..."
log_info "Database: ${MONGO_DB}"
log_info "Backup path: ${BACKUP_PATH}"

# Create backup
if mongodump --uri="${MONGO_URI}" --db="${MONGO_DB}" --out="${BACKUP_PATH}" --gzip; then
    log_info "Backup created successfully"
    
    # Create tar archive
    TAR_FILE="${BACKUP_PATH}.tar.gz"
    tar -czf "${TAR_FILE}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
    
    if [ $? -eq 0 ]; then
        log_info "Backup compressed: ${TAR_FILE}"
        
        # Remove uncompressed backup
        rm -rf "${BACKUP_PATH}"
        
        # Get backup size
        BACKUP_SIZE=$(du -h "${TAR_FILE}" | cut -f1)
        log_info "Backup size: ${BACKUP_SIZE}"
        
        # Upload to S3 if configured
        if [ -n "${S3_BUCKET}" ]; then
            log_info "Uploading to S3..."
            if aws s3 cp "${TAR_FILE}" "s3://${S3_BUCKET}/${S3_PATH}/${BACKUP_NAME}.tar.gz"; then
                log_info "Backup uploaded to S3 successfully"
            else
                log_warning "Failed to upload to S3"
            fi
        fi
        
        # Remove old backups (local)
        log_info "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
        find "${BACKUP_DIR}" -name "mongodb_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
        
        # Remove old S3 backups if configured
        if [ -n "${S3_BUCKET}" ] && command -v aws &> /dev/null; then
            CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
            log_info "Removing S3 backups older than ${CUTOFF_DATE}..."
            aws s3 ls "s3://${S3_BUCKET}/${S3_PATH}/" | while read -r line; do
                FILE_DATE=$(echo "$line" | awk '{print $1}')
                FILE_NAME=$(echo "$line" | awk '{print $4}')
                if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
                    aws s3 rm "s3://${S3_BUCKET}/${S3_PATH}/${FILE_NAME}"
                    log_info "Deleted old S3 backup: ${FILE_NAME}"
                fi
            done
        fi
        
        log_info "Backup completed successfully!"
        exit 0
    else
        log_error "Failed to compress backup"
        exit 1
    fi
else
    log_error "Backup failed"
    exit 1
fi
