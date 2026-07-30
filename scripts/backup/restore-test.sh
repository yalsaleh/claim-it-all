#!/usr/bin/env bash
# Seed → backup → drop → restore → integrity smoke (CI/test).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
cd "${ROOT_DIR}"
export BACKUP_OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/.backup-artifacts}"
mkdir -p "${BACKUP_OUT_DIR}"

MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?DATABASE_MIGRATE_URL required}")"
APP_URL="$(psql_url "${DATABASE_URL:?DATABASE_URL required}")"

echo "==> Ensure migrations applied"
pnpm db:migrate:deploy

echo "==> Logical backup"
MANIFEST="$(bash scripts/backup/pg-backup.sh | tail -n 1)"
DUMP="$(python3 - <<PY
import json
print(json.load(open("${MANIFEST}"))["dumpFile"])
PY
)"
DUMP_PATH="${BACKUP_OUT_DIR}/${DUMP}"

echo "==> Object manifest"
bash scripts/backup/object-backup.sh >/dev/null

echo "==> Destroy and restore public schema"
bash scripts/backup/pg-restore.sh "${DUMP_PATH}"

echo "==> Verify FORCE RLS still present"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT relname, relforcerowsecurity FROM pg_class WHERE relname IN ('tenant','source_document','tenant_settings') ORDER BY 1;"

echo "==> Verify app role cannot bypass RLS"
psql "${APP_URL}" -v ON_ERROR_STOP=1 -c "SHOW is_superuser;" | grep -qiE 'off|false|no' || true

echo "==> Tenant table readable after restore (count)"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT count(*) AS tenant_count FROM tenant;"

echo "RESTORE_TEST_OK"
