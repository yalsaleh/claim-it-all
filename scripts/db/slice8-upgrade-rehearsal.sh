#!/usr/bin/env bash
# Rehearse Slice 8 → Slice 9 upgrade without migrate reset.
# Strategy: deploy all migrations except Slice 9, seed, then deploy Slice 9 only.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../backup/lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
cd "${ROOT_DIR}"

OUT_DIR="${MIGRATION_OUT_DIR:-${ROOT_DIR}/artifacts/migration}"
mkdir -p "${OUT_DIR}"
MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?}")"
APP_URL="$(psql_url "${DATABASE_URL:?}")"
WEB_MIG="${ROOT_DIR}/apps/web/prisma/migrations"
SLICE9="20260729220000_production_hardening_slice9"
HOLD="${OUT_DIR}/_held_slice9"

echo "==> Hold Slice 9 migration aside"
rm -rf "${HOLD}"
mkdir -p "${HOLD}"
if [[ -d "${WEB_MIG}/${SLICE9}" ]]; then
  mv "${WEB_MIG}/${SLICE9}" "${HOLD}/"
fi
cleanup() {
  if [[ -d "${HOLD}/${SLICE9}" ]]; then
    mv "${HOLD}/${SLICE9}" "${WEB_MIG}/"
  fi
}
trap cleanup EXIT

echo "==> Migrate to Slice 8 baseline (all migrations except Slice 9)"
pnpm db:migrate:deploy
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at" \
  | tee "${OUT_DIR}/slice8-migrations.txt"
if grep -q "${SLICE9}" "${OUT_DIR}/slice8-migrations.txt"; then
  echo "Slice 9 should not be applied yet"; exit 1
fi
echo "SLICE8_BASELINE_OK" | tee "${OUT_DIR}/slice8-baseline.txt"

echo "==> Seed representative prior data"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT set_config('app.bypass_rls', 'on', false);
INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt")
VALUES ('88000000-0000-4000-8000-000000000001', 'Slice8 Tenant', 'slice8-upgrade-tenant', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
INSERT INTO "user" (id, email, name, status, "createdAt", "updatedAt")
VALUES ('88000000-0000-4000-8000-0000000000aa', 'slice8-upgrade@example.com', 'Slice8 User', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO tenant_membership (id, "tenantId", "userId", role, status, "createdAt", "updatedAt")
VALUES ('88000000-0000-4000-8000-0000000000bb', '88000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-0000000000aa', 'TENANT_OWNER', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO project (id, "tenantId", name, code, status, "countryCode", "defaultCurrency", timezone, "createdAt", "updatedAt")
VALUES ('88000000-0000-4000-8000-0000000000cc', '88000000-0000-4000-8000-000000000001', 'Slice8 Project', 'S8U', 'ACTIVE', 'AE', 'AED', 'Asia/Dubai', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
SQL
BEFORE="$(psql "${MIGRATE_URL}" -Atc "SELECT count(*) FROM project WHERE id='88000000-0000-4000-8000-0000000000cc'")"
[[ "${BEFORE}" == "1" ]] || { echo "seed failed"; exit 1; }

echo "==> Restore Slice 9 migration and upgrade forward-only (no reset)"
cleanup
trap - EXIT
pnpm db:migrate:deploy
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name='${SLICE9}'" \
  | tee "${OUT_DIR}/slice9-applied.txt"
grep -q "${SLICE9}" "${OUT_DIR}/slice9-applied.txt"

AFTER="$(psql "${MIGRATE_URL}" -Atc "SELECT count(*) FROM project WHERE id='88000000-0000-4000-8000-0000000000cc'")"
[[ "${AFTER}" == "1" ]] || { echo "prior data lost"; exit 1; }

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "\dt tenant_settings" | tee "${OUT_DIR}/slice9-tables.txt"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "\dt backup_run" | tee -a "${OUT_DIR}/slice9-tables.txt"
psql "${MIGRATE_URL}" -Atc "SELECT relname||':'||relrowsecurity||':'||relforcerowsecurity FROM pg_class WHERE relname IN ('tenant','project','tenant_settings') ORDER BY 1" \
  | tee "${OUT_DIR}/rls-after-upgrade.txt"

python3 - <<PY
import json, pathlib
out=pathlib.Path("${OUT_DIR}")
doc={
  "status": "PASS",
  "mode": "slice8_to_slice9_forward_upgrade",
  "priorProjectPreserved": True,
  "slice9Migration": "${SLICE9}",
  "notes": "Not a migrate reset. Slice 9 was held aside, baseline applied, data seeded, then Slice 9 applied."
}
(out/"slice8-to-slice9-report.json").write_text(json.dumps(doc, indent=2)+"\n")
print("SLICE8_TO_SLICE9_OK")
PY
