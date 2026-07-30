#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../backup/lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
cd "${ROOT_DIR}"

if [[ -z "${DATABASE_MIGRATE_URL:-${DATABASE_URL:-}}" ]]; then
  echo "NOT RUN — PostgreSQL unavailable (no DATABASE_URL)"
  exit 0
fi

set +e
PROBE="$(psql "$(psql_url "${DATABASE_MIGRATE_URL:-$DATABASE_URL}")" -Atc 'SELECT 1' 2>&1)"
PROBE_CODE=$?
set -e
if [[ "${PROBE_CODE}" -ne 0 ]]; then
  if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" || "${REQUIRE_INTEGRATION_DB:-}" == "true" ]]; then
    echo "MIGRATE_VERIFY_FAILED — PostgreSQL required in CI"
    echo "${PROBE}"
    exit 1
  fi
  echo "NOT RUN — PostgreSQL unavailable"
  exit 0
fi

pnpm db:migrate:deploy
PSQL_URL="$(psql_url "${DATABASE_MIGRATE_URL:-${DATABASE_URL:?}}")"
psql "${PSQL_URL}" -v ON_ERROR_STOP=1 -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 5;"
echo "MIGRATE_VERIFY_OK"
