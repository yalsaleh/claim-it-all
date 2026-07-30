#!/usr/bin/env bash
# Logical PostgreSQL backup for CI/test infrastructure. No production credentials.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/artifacts/backup}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:-${DATABASE_URL:?DATABASE_URL required}}")"
mkdir -p "${OUT_DIR}"

DUMP_FILE="${OUT_DIR}/pg-${STAMP}.sql"
MANIFEST="${OUT_DIR}/pg-${STAMP}.manifest.json"

echo "Creating logical backup → ${DUMP_FILE}"
pg_dump --no-owner --no-acl --format=plain "${MIGRATE_URL}" > "${DUMP_FILE}"
if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM="$(sha256sum "${DUMP_FILE}" | awk '{print $1}')"
else
  CHECKSUM="$(shasum -a 256 "${DUMP_FILE}" | awk '{print $1}')"
fi

python3 - "${MANIFEST}" "${STAMP}" "${DUMP_FILE}" "${CHECKSUM}" "${OUT_DIR}" <<'PY'
import json, pathlib, sys
manifest = pathlib.Path(sys.argv[1])
stamp, dump_file, checksum, out_dir = sys.argv[2], sys.argv[3], sys.argv[4], pathlib.Path(sys.argv[5])
doc = {
  "type": "postgresql_logical",
  "createdAt": stamp,
  "dumpFile": pathlib.Path(dump_file).name,
  "checksumSha256": checksum,
  "encryptionStatus": "plaintext_local_artifact",
  "note": "CI/test artifact only — not a production encrypted backup claim",
}
manifest.write_text(json.dumps(doc, indent=2) + "\n")
(out_dir / "backup-manifest.json").write_text(json.dumps(doc, indent=2) + "\n")
(out_dir / "database-checksum.txt").write_text(checksum + "\n")
(out_dir / "database-backup-metadata.json").write_text(json.dumps({
  "type": doc["type"],
  "createdAt": stamp,
  "dumpFile": doc["dumpFile"],
  "bytes": pathlib.Path(dump_file).stat().st_size,
  "checksumSha256": checksum,
}, indent=2) + "\n")
print(f"Manifest: {manifest}")
print(f"Checksum: {checksum}")
print(str(manifest))
PY
