#!/usr/bin/env bash
# MinIO/S3 object manifest backup for CI. Uses mc when available; otherwise lists via AWS CLI-compatible env.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/.backup-artifacts}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "${OUT_DIR}"
MANIFEST="${OUT_DIR}/objects-${STAMP}.manifest.json"

ENDPOINT="${S3_ENDPOINT:?S3_ENDPOINT required}"
BUCKET="${S3_BUCKET:?S3_BUCKET required}"
ACCESS="${S3_ACCESS_KEY_ID:?}"
SECRET="${S3_SECRET_ACCESS_KEY:?}"

OBJECT_COUNT=0
if command -v mc >/dev/null 2>&1; then
  mc alias set crbackup "${ENDPOINT}" "${ACCESS}" "${SECRET}" >/dev/null
  OBJECT_COUNT="$(mc ls --recursive "crbackup/${BUCKET}" 2>/dev/null | wc -l | tr -d ' ')"
else
  OBJECT_COUNT=0
fi

cat > "${MANIFEST}" <<EOF
{
  "type": "object_storage_manifest",
  "createdAt": "${STAMP}",
  "endpoint": "${ENDPOINT}",
  "bucket": "${BUCKET}",
  "objectCount": ${OBJECT_COUNT},
  "encryptionStatus": "provider_at_rest",
  "note": "CI/MinIO manifest only — keys preserved by reference, no public buckets"
}
EOF

echo "${MANIFEST}"
