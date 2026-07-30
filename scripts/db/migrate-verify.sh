#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
pnpm db:migrate:deploy
psql "${DATABASE_MIGRATE_URL:?}" -v ON_ERROR_STOP=1 -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 5;"
echo "MIGRATE_VERIFY_OK"
