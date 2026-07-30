#!/usr/bin/env bash
# Restore logical PostgreSQL dump into a target URL (destructive to target DB).
set -euo pipefail

DUMP_FILE="${1:?Usage: pg-restore.sh <dump.sql>}"
TARGET_URL="${RESTORE_DATABASE_URL:-${DATABASE_MIGRATE_URL:?RESTORE_DATABASE_URL or DATABASE_MIGRATE_URL required}}"

echo "Restoring ${DUMP_FILE} → target"
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${DUMP_FILE}"
echo "Restore completed"
