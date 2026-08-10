#!/usr/bin/env bash
# True Slice 8 (commit 0e6ff4e) → current forward upgrade rehearsal.
# Does NOT use prisma migrate reset for the upgrade stage.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../backup/lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
cd "${ROOT_DIR}"

OUT_DIR="${MIGRATION_OUT_DIR:-${ROOT_DIR}/artifacts/migration}"
mkdir -p "${OUT_DIR}"
LOG_FILE="${OUT_DIR}/slice8-upgrade-rehearsal.log"
: > "${LOG_FILE}"
log() { echo "$@" | tee -a "${LOG_FILE}"; }

MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?}")"
APP_URL="$(psql_url "${DATABASE_URL:?}")"

BASELINE_COMMIT="${SLICE8_BASELINE_COMMIT:-0e6ff4e0c529b23ad7bde881b029079ef60e3ff4}"
TARGET_COMMIT="$(git -C "${ROOT_DIR}" rev-parse HEAD)"
WORKTREE="${RUNNER_TEMP:-/tmp}/slice8-worktree-${TARGET_COMMIT:0:12}"
SLICE9="20260729220000_production_hardening_slice9"

cleanup() {
  if git -C "${ROOT_DIR}" worktree list 2>/dev/null | grep -q "${WORKTREE}"; then
    git -C "${ROOT_DIR}" worktree remove --force "${WORKTREE}" 2>/dev/null || true
  fi
  rm -rf "${WORKTREE}" 2>/dev/null || true
}
trap cleanup EXIT

log "==> Verify baseline commit ${BASELINE_COMMIT}"
git -C "${ROOT_DIR}" cat-file -t "${BASELINE_COMMIT}" >/dev/null
BASELINE_FULL="$(git -C "${ROOT_DIR}" rev-parse "${BASELINE_COMMIT}")"
echo "${BASELINE_FULL}" | tee "${OUT_DIR}/baseline-commit.txt" | tee -a "${LOG_FILE}"
echo "${TARGET_COMMIT}" | tee "${OUT_DIR}/target-commit.txt" | tee -a "${LOG_FILE}"

if git -C "${ROOT_DIR}" ls-tree -d --name-only "${BASELINE_FULL}:apps/web/prisma/migrations" \
  | grep -qx "${SLICE9}"; then
  log "FAIL: baseline ${BASELINE_FULL} unexpectedly contains ${SLICE9}"; exit 1
fi
git -C "${ROOT_DIR}" ls-tree -d --name-only "${BASELINE_FULL}:apps/web/prisma/migrations" \
  | grep -qx "20260729210000_connectors_operations_slice8" \
  || { log "FAIL: baseline missing Slice 8 migration"; exit 1; }
echo "BASELINE_COMMIT_OK" | tee "${OUT_DIR}/baseline-verification.txt" | tee -a "${LOG_FILE}"

log "==> Reset database schema (clean prior-version start; not the upgrade step)"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;"

log "==> Checkout baseline ${BASELINE_FULL} into worktree ${WORKTREE}"
rm -rf "${WORKTREE}"
git -C "${ROOT_DIR}" worktree add --detach "${WORKTREE}" "${BASELINE_FULL}"
test -f "${WORKTREE}/package.json"
test -d "${WORKTREE}/apps/web/prisma/migrations/20260729210000_connectors_operations_slice8"

log "==> Install baseline dependencies + apply Slice 8 migrations"
(
  cd "${WORKTREE}"
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.15.0 --activate >/dev/null 2>&1 || true
  # Do not use --prefer-offline: Slice 8 lockfile may need store fetches.
  pnpm install --frozen-lockfile
  pnpm validate:prisma
  pnpm db:generate
  DATABASE_URL="${DATABASE_MIGRATE_URL}" DATABASE_MIGRATE_URL="${DATABASE_MIGRATE_URL}" pnpm db:migrate:deploy
) 2>&1 | tee -a "${LOG_FILE}"

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at NULLS LAST, migration_name" \
  | tee "${OUT_DIR}/slice8-migrations.txt" | tee -a "${LOG_FILE}"
if grep -q "${SLICE9}" "${OUT_DIR}/slice8-migrations.txt"; then
  log "FAIL: Slice 9 applied during baseline stage"; exit 1
fi
grep -q "20260729210000_connectors_operations_slice8" "${OUT_DIR}/slice8-migrations.txt"

log "==> Seed representative Slice 8 data"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -f "${ROOT_DIR}/scripts/db/slice8-seed-representative.sql" \
  2>&1 | tee -a "${LOG_FILE}"

MIGRATE_URL="${MIGRATE_URL}" OUT_DIR="${OUT_DIR}" python3 - <<'PY' 2>&1 | tee -a "${OUT_DIR}/slice8-upgrade-rehearsal.log"
import json, os, pathlib, subprocess
url = os.environ["MIGRATE_URL"]
out_dir = pathlib.Path(os.environ["OUT_DIR"])
tables = [
  "tenant","project","user","tenant_membership","source_document","document_version",
  "contract_package","contract_configuration_revision","approved_notice_rule_snapshot",
  "project_event","project_deadline","notice_package","notice_dispatch_attempt",
  "dispatch_evidence","connector_account","operational_alert",
]
counts = {}
for t in tables:
    q = f'SELECT count(*) FROM "{t}"' if t == "user" else f"SELECT count(*) FROM {t}"
    counts[t] = int(subprocess.check_output(["psql", url, "-Atc", q], text=True).strip())
doc = {
  "counts": counts,
  "ids": {
    "tenantA": "88000000-0000-4000-8000-000000000001",
    "tenantB": "88000000-0000-4000-8000-000000000002",
    "projectA1": "88000000-0000-4000-8000-0000000000c1",
    "deadline": "88000000-0000-4000-8000-0000000000dl",
    "notice": "88000000-0000-4000-8000-0000000000np",
    "dispatch": "88000000-0000-4000-8000-0000000000da",
  },
}
out_dir.joinpath("row-counts-before.json").write_text(json.dumps(doc, indent=2) + "\n")
assert counts["tenant"] >= 2 and counts["project"] >= 3
assert counts["project_deadline"] >= 1 and counts["notice_package"] >= 1
assert counts["notice_dispatch_attempt"] >= 1
print("SEED_OK", counts)
PY

log "==> Switch to current commit tooling and apply forward migrations (no reset)"
cleanup
trap - EXIT
cd "${ROOT_DIR}"
pnpm install --frozen-lockfile 2>&1 | tee -a "${LOG_FILE}"
pnpm validate:prisma
pnpm db:generate
DATABASE_URL="${DATABASE_MIGRATE_URL}" pnpm db:migrate:deploy 2>&1 | tee -a "${LOG_FILE}"

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name='${SLICE9}'" \
  | tee "${OUT_DIR}/slice9-applied.txt" | tee -a "${LOG_FILE}"
grep -q "${SLICE9}" "${OUT_DIR}/slice9-applied.txt"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at NULLS LAST, migration_name" \
  | tee "${OUT_DIR}/migrations-after.txt" | tee -a "${LOG_FILE}"

log "==> Verify baseline records remain readable"
MIGRATE_URL="${MIGRATE_URL}" OUT_DIR="${OUT_DIR}" python3 - <<'PY'
import json, os, pathlib, subprocess
url = os.environ["MIGRATE_URL"]
out = pathlib.Path(os.environ["OUT_DIR"])
before = json.loads((out/"row-counts-before.json").read_text())
tables = list(before["counts"].keys())
after = {}
for t in tables:
    q = f'SELECT count(*) FROM "{t}"' if t == "user" else f"SELECT count(*) FROM {t}"
    after[t] = int(subprocess.check_output(["psql", url, "-Atc", q], text=True).strip())
(out/"row-counts-after.json").write_text(json.dumps({"counts": after}, indent=2)+"\n")
for t, c in before["counts"].items():
    if after[t] < c:
        raise SystemExit(f"row loss on {t}: before={c} after={after[t]}")
for key, oid in before["ids"].items():
    table = {
      "tenantA":"tenant","tenantB":"tenant","projectA1":"project",
      "deadline":"project_deadline","notice":"notice_package","dispatch":"notice_dispatch_attempt",
    }[key]
    n = int(subprocess.check_output(["psql", url, "-Atc", f"SELECT count(*) FROM {table} WHERE id='{oid}'"], text=True).strip())
    if n != 1:
        raise SystemExit(f"missing baseline id {key}={oid}")
print("BASELINE_DATA_PRESERVED")
PY

log "==> Verify Slice 9 tables + RLS/FORCE RLS"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "\dt tenant_settings" | tee "${OUT_DIR}/slice9-tables.txt"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c "\dt backup_run" | tee -a "${OUT_DIR}/slice9-tables.txt"
psql "${MIGRATE_URL}" -Atc \
  "SELECT relname||':'||relrowsecurity||':'||relforcerowsecurity FROM pg_class WHERE relname IN ('tenant','project','tenant_settings','backup_run') ORDER BY 1" \
  | tee "${OUT_DIR}/rls-after-upgrade.txt"
python3 - <<PY
rows=open("${OUT_DIR}/rls-after-upgrade.txt").read().splitlines()
norm=[r.replace("true","t").replace("false","f") for r in rows]
ok=all(any(n.startswith(name+":") and n.endswith(":t:t") for n in norm) for name in ("tenant","project"))
open("${OUT_DIR}/rls-result.json","w").write(__import__("json").dumps({"ok": ok, "rows": rows}, indent=2)+"\n")
raise SystemExit(0 if ok else 1)
PY

log "==> Cross-tenant isolation after upgrade"
psql "${APP_URL}" -v ON_ERROR_STOP=1 <<'SQL' > "${OUT_DIR}/isolation.txt"
SELECT set_config('app.bypass_rls', 'off', false);
SELECT set_config('app.current_user_id', '88000000-0000-4000-8000-0000000000aa', false);
SELECT set_config('app.current_tenant_id', '88000000-0000-4000-8000-000000000001', false);
SELECT count(*) FROM project WHERE id = '88000000-0000-4000-8000-0000000000c3';
SELECT set_config('app.current_tenant_id', '', false);
SELECT count(*) FROM project;
SQL
python3 - <<PY
import json, pathlib, re
text=pathlib.Path("${OUT_DIR}/isolation.txt").read_text()
nums=[int(x) for x in re.findall(r"^\s*(\d+)\s*$", text, re.M)]
ok=len(nums)>=2 and nums[0]==0 and nums[1]==0
pathlib.Path("${OUT_DIR}/tenant-isolation-result.json").write_text(json.dumps({"ok": ok, "counts": nums}, indent=2)+"\n")
raise SystemExit(0 if ok else 1)
PY

log "==> Runtime role restricted; migration role can DDL"
IS_SUPER="$(psql "${APP_URL}" -Atc 'SHOW is_superuser')"
echo "app_is_superuser=${IS_SUPER}" | tee "${OUT_DIR}/runtime-role.txt"
echo "${IS_SUPER}" | grep -qiE 'off|false|no'
if psql "${APP_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE runtime_upgrade_probe(id int);' >/dev/null 2>&1; then
  log "FAIL: runtime created table"; exit 1
fi
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS migrator_upgrade_probe(id int); DROP TABLE migrator_upgrade_probe;'
echo '{"runtimeRestricted":true,"migrationRoleCanDDL":true}' > "${OUT_DIR}/role-result.json"

python3 - <<PY
import json, pathlib
out=pathlib.Path("${OUT_DIR}")
before=json.loads((out/"row-counts-before.json").read_text())
after=json.loads((out/"row-counts-after.json").read_text())
rls=json.loads((out/"rls-result.json").read_text())
iso=json.loads((out/"tenant-isolation-result.json").read_text())
roles=json.loads((out/"role-result.json").read_text())
migrations=[ln.strip() for ln in (out/"migrations-after.txt").read_text().splitlines() if ln.strip() and not ln.startswith("-") and "migration_name" not in ln and not ln.startswith("(")]
doc={
  "status": "PASS",
  "mode": "true_prior_version_checkout_upgrade",
  "baselineCommit": "${BASELINE_FULL}",
  "targetCommit": "${TARGET_COMMIT}",
  "commitSha": "${TARGET_COMMIT}",
  "slice9Migration": "${SLICE9}",
  "migrationsApplied": migrations,
  "rowCountsBefore": before["counts"],
  "rowCountsAfter": after["counts"],
  "tenantIsolation": iso,
  "rls": rls,
  "roleSeparation": roles,
  "notes": "Checked out verified Slice 8 commit 0e6ff4e into a git worktree, migrated+seeded, then applied current migrations without reset. Real historical upgrade; synthetic CI DB only.",
}
(out/"slice8-to-slice9-report.json").write_text(json.dumps(doc, indent=2)+"\n")
print("SLICE8_TO_SLICE9_OK")
PY
