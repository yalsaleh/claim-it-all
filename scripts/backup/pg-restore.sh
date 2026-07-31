#!/usr/bin/env bash
# Restore logical PostgreSQL dump into a target URL (destructive to target DB).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"

DUMP_FILE="${1:?Usage: pg-restore.sh <dump.sql>}"
TARGET_URL="$(psql_url "${RESTORE_DATABASE_URL:-${DATABASE_MIGRATE_URL:?RESTORE_DATABASE_URL or DATABASE_MIGRATE_URL required}}")"

if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "ERROR: dump file does not exist: ${DUMP_FILE}" >&2
  exit 1
fi
if [[ ! -s "${DUMP_FILE}" ]]; then
  echo "ERROR: dump file is empty: ${DUMP_FILE}" >&2
  exit 1
fi

echo "Restoring ${DUMP_FILE} → target"
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
psql "${TARGET_URL}" -v ON_ERROR_STOP=1 -f "${DUMP_FILE}"
echo "Restore completed"
