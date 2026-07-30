#!/usr/bin/env bash
# Pre-deploy migration safety check.
# Pending (unapplied) migrations are expected before `migrate deploy` and must not fail this script.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}/apps/web"

echo "==> prisma validate"
pnpm exec prisma validate

echo "==> prisma migrate status (pending before deploy is OK)"
set +e
STATUS_OUT="$(pnpm exec prisma migrate status 2>&1)"
STATUS_CODE=$?
set -e
printf '%s\n' "${STATUS_OUT}"

if [[ "${STATUS_CODE}" -eq 0 ]]; then
  echo "MIGRATE_CHECK_OK (database up to date)"
  exit 0
fi

if printf '%s\n' "${STATUS_OUT}" | grep -qiE \
  'have not yet been applied|Following migration|No migration found in the database|not yet been applied'; then
  echo "MIGRATE_CHECK_OK (pending migrations; deploy required)"
  exit 0
fi

echo "MIGRATE_CHECK_FAILED"
exit "${STATUS_CODE}"
