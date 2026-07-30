#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}/apps/web"
echo "==> prisma validate"
pnpm exec prisma validate
echo "==> prisma migrate status"
pnpm exec prisma migrate status
echo "MIGRATE_CHECK_OK"
