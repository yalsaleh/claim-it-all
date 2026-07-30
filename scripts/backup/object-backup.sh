#!/usr/bin/env bash
# MinIO/S3 object byte backup for synthetic CI restore (not a cloud DR claim).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/artifacts/backup}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${OUT_DIR}"
DATA_DIR="${OUT_DIR}/objects-${STAMP}"
MANIFEST="${OUT_DIR}/objects-${STAMP}.manifest.json"
STABLE_MANIFEST="${OUT_DIR}/object-manifest.json"
CHECKSUM_SUMMARY="${OUT_DIR}/object-checksum-summary.json"
mkdir -p "${DATA_DIR}"

ENDPOINT="${S3_ENDPOINT:?S3_ENDPOINT required}"
BUCKET="${S3_BUCKET:?S3_BUCKET required}"
ACCESS="${S3_ACCESS_KEY_ID:?}"
SECRET="${S3_SECRET_ACCESS_KEY:?}"

command -v mc >/dev/null || { echo "mc (MinIO client) required"; exit 1; }
mc alias set crbackup "${ENDPOINT}" "${ACCESS}" "${SECRET}" >/dev/null
mc mirror --overwrite "crbackup/${BUCKET}" "${DATA_DIR}/" >/dev/null

python3 - <<PY
import hashlib, json, pathlib
root = pathlib.Path("${DATA_DIR}")
objects = []
for path in sorted(root.rglob("*")):
    if not path.is_file():
        continue
    rel = path.relative_to(root).as_posix()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    objects.append({"key": rel, "sha256": digest, "bytes": path.stat().st_size})
doc = {
  "type": "object_storage_byte_backup",
  "createdAt": "${STAMP}",
  "endpoint": "${ENDPOINT}",
  "bucket": "${BUCKET}",
  "dataDir": pathlib.Path("${DATA_DIR}").name,
  "objectCount": len(objects),
  "objects": objects,
  "encryptionStatus": "plaintext_local_artifact",
  "note": "Synthetic CI MinIO byte backup — keys preserved; not a production encrypted object backup claim",
}
pathlib.Path("${MANIFEST}").write_text(json.dumps(doc, indent=2) + "\n")
pathlib.Path("${STABLE_MANIFEST}").write_text(json.dumps(doc, indent=2) + "\n")
pathlib.Path("${CHECKSUM_SUMMARY}").write_text(json.dumps({"objects": objects}, indent=2) + "\n")
print("${MANIFEST}")
PY
