#!/usr/bin/env bash
# Logical PostgreSQL backup for CI/test infrastructure. No production credentials.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/.backup-artifacts}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MIGRATE_URL="${DATABASE_MIGRATE_URL:-${DATABASE_URL:?DATABASE_URL required}}"
mkdir -p "${OUT_DIR}"

DUMP_FILE="${OUT_DIR}/pg-${STAMP}.sql"
MANIFEST="${OUT_DIR}/pg-${STAMP}.manifest.json"

echo "Creating logical backup → ${DUMP_FILE}"
pg_dump --no-owner --no-acl --format=plain "${MIGRATE_URL}" > "${DUMP_FILE}"
CHECKSUM="$(shasum -a 256 "${DUMP_FILE}" | awk '{print $1}')"
MIGRATION_VERSION="$(cd "${ROOT_DIR}/apps/web" && pnpm exec prisma migrate status 2>/dev/null | tail -n 20 || true)"

cat > "${MANIFEST}" <<EOF
{
  "type": "postgresql_logical",
  "createdAt": "${STAMP}",
  "dumpFile": "$(basename "${DUMP_FILE}")",
  "checksumSha256": "${CHECKSUM}",
  "encryptionStatus": "plaintext_local_artifact",
  "migrationStatusSnippet": $(python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' <<<"${MIGRATION_VERSION}"),
  "note": "CI/test artifact only — not a production encrypted backup claim"
}
EOF

echo "Manifest: ${MANIFEST}"
echo "Checksum: ${CHECKSUM}"
echo "${MANIFEST}"
