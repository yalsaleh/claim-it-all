#!/usr/bin/env bash
# Restore object bytes from a local CI object backup directory + manifest.
set -euo pipefail

MANIFEST="${1:?Usage: object-restore.sh <objects.manifest.json>}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/artifacts/backup}"

ENDPOINT="${S3_ENDPOINT:?}"
BUCKET="${S3_BUCKET:?}"
ACCESS="${S3_ACCESS_KEY_ID:?}"
SECRET="${S3_SECRET_ACCESS_KEY:?}"

command -v mc >/dev/null || { echo "mc required"; exit 1; }

DATA_DIR="$(python3 - <<PY
import hashlib, json, pathlib, sys
manifest_path = pathlib.Path("${MANIFEST}")
doc = json.loads(manifest_path.read_text())
if doc.get("type") != "object_storage_byte_backup":
    raise SystemExit("invalid object backup manifest type")
data_dir = pathlib.Path("${OUT_DIR}") / doc["dataDir"]
if not data_dir.is_dir():
    raise SystemExit(f"missing object backup data dir: {data_dir}")
expected = {o["key"]: o["sha256"] for o in doc.get("objects", [])}
if not expected:
    raise SystemExit("object backup manifest has no objects")
for key, want in expected.items():
    path = data_dir / key
    if not path.is_file():
        raise SystemExit(f"missing object in backup: {key}")
    got = hashlib.sha256(path.read_bytes()).hexdigest()
    if got != want:
        raise SystemExit(f"checksum mismatch before restore: {key}")
print(str(data_dir))
PY
)"

mc alias set crrestore "${ENDPOINT}" "${ACCESS}" "${SECRET}" >/dev/null
mc mb -p "crrestore/${BUCKET}" >/dev/null || true
mc mirror --overwrite "${DATA_DIR}/" "crrestore/${BUCKET}" >/dev/null
echo "Object restore completed from ${MANIFEST}"
