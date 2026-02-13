#!/bin/bash
#
# MongoDB Restore Script
# Restores database from a backup archive
#

# Configuration
BACKUP_FILE="${1}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017}"
MONGO_DB="${MONGO_DB:-devplatform}"
TEMP_DIR="/tmp/mongodb_restore_$$"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check arguments
if [ -z "${BACKUP_FILE}" ]; then
    log_error "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Check if mongorestore is available
if ! command -v mongorestore &> /dev/null; then
    log_error "mongorestore not found. Install MongoDB Database Tools."
    exit 1
fi

log_warning "This will restore the database: ${MONGO_DB}"
log_warning "ALL EXISTING DATA WILL BE REPLACED!"
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    log_info "Restore cancelled"
    exit 0
fi

# Create temp directory
mkdir -p "${TEMP_DIR}"

log_info "Extracting backup..."
if tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"; then
    log_info "Backup extracted successfully"
else
    log_error "Failed to extract backup"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Find the database directory
DB_DIR=$(find "${TEMP_DIR}" -type d -name "${MONGO_DB}" | head -n 1)

if [ -z "${DB_DIR}" ]; then
    log_error "Database directory not found in backup"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

log_info "Restoring database from: ${DB_DIR}"

# Restore database
if mongorestore --uri="${MONGO_URI}" --db="${MONGO_DB}" --drop --gzip "${DB_DIR}"; then
    log_info "Database restored successfully!"
    
    # Cleanup
    rm -rf "${TEMP_DIR}"
    log_info "Cleanup completed"
    exit 0
else
    log_error "Restore failed"
    rm -rf "${TEMP_DIR}"
    exit 1
fi
