#!/usr/bin/env bash
# Prove migration drift detection without mutating committed migrations.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../backup/lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
OUT_DIR="${MIGRATION_OUT_DIR:-${ROOT_DIR}/artifacts/migration}"
mkdir -p "${OUT_DIR}"
MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?}")"
cd "${ROOT_DIR}/apps/web"

echo "==> Baseline migrate status (expect up to date after deploy)"
set +e
STATUS_OUT="$(pnpm exec prisma migrate status 2>&1)"
STATUS_CODE=$?
set -e
printf '%s\n' "${STATUS_OUT}" | tee "${OUT_DIR}/migrate-status-baseline.txt"
[[ "${STATUS_CODE}" -eq 0 ]] || { echo "Baseline status not clean"; exit 1; }

echo "==> Intentional drift: create untracked table as migrator"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS drift_canary_table(id int primary key);'
# prisma migrate diff --from-migrations --to-schema-datamodel can detect, or migrate status won't.
# Use migrate diff exit code.
set +e
DIFF_OUT="$(pnpm exec prisma migrate diff \
  --from-url "${DATABASE_MIGRATE_URL}" \
  --to-schema-datamodel prisma/schema.prisma \
  --script 2>&1)"
DIFF_CODE=$?
set -e
printf '%s\n' "${DIFF_OUT}" | tee "${OUT_DIR}/migrate-diff-drift.txt"
echo "${DIFF_OUT}" | grep -qi 'drift_canary_table\|DROP TABLE\|ALTER' \
  || { echo "Expected drift markers missing"; exit 1; }

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c 'DROP TABLE IF EXISTS drift_canary_table;'

echo "==> Intentional drift: edited migration copy (do not mutate committed files)"
COPY_DIR="${OUT_DIR}/_drift_migration_copy"
rm -rf "${COPY_DIR}"
mkdir -p "${COPY_DIR}"
FIRST_MIG="$(ls -1 "${ROOT_DIR}/apps/web/prisma/migrations" | grep -E '^[0-9]+_' | head -n 1)"
cp -R "${ROOT_DIR}/apps/web/prisma/migrations/${FIRST_MIG}" "${COPY_DIR}/"
echo "-- intentional drift marker" >> "${COPY_DIR}/${FIRST_MIG}/migration.sql"
ORIG_HASH="$(shasum -a 256 "${ROOT_DIR}/apps/web/prisma/migrations/${FIRST_MIG}/migration.sql" | awk '{print $1}')"
COPY_HASH="$(shasum -a 256 "${COPY_DIR}/${FIRST_MIG}/migration.sql" | awk '{print $1}')"
[[ "${ORIG_HASH}" != "${COPY_HASH}" ]] || { echo "copy edit did not change hash"; exit 1; }
# Prove committed tree is unchanged
git -C "${ROOT_DIR}" diff --exit-code -- "apps/web/prisma/migrations/${FIRST_MIG}/migration.sql" \
  || { echo "committed migration was mutated"; exit 1; }

python3 - <<PY
import json, pathlib
pathlib.Path("${OUT_DIR}/migration-drift-report.json").write_text(json.dumps({
  "status": "PASS",
  "detectedIntentionalDrift": True,
  "methods": [
    "prisma migrate diff after creating drift_canary_table",
    "edited migration copy hash divergence with committed file unchanged",
  ],
  "editedMigrationCopy": "${FIRST_MIG}",
  "committedHash": "${ORIG_HASH}",
  "editedCopyHash": "${COPY_HASH}",
}, indent=2)+"\n")
print("MIGRATION_DRIFT_OK")
PY
