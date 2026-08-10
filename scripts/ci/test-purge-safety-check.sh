#!/usr/bin/env bash
# Prove test-only purge GUCs / helpers fail closed in STAGING/PILOT/PRODUCTION.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../backup/lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
OUT_DIR="${PROD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/production-readiness}"
mkdir -p "${OUT_DIR}"
MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?}")"
APP_URL="$(psql_url "${DATABASE_URL:?}")"

results_file="${OUT_DIR}/test-purge-results.ndjson"
: > "${results_file}"

append_result() {
  echo "$1" >> "${results_file}"
}

echo "==> Source scan: production paths must not enable purge GUCs"
SRC_HITS="$(
  rg -n "allow_(audit|ops|notice|deadline|detection|contract_revision)_purge" \
    "${ROOT_DIR}/apps/web/src" \
    --glob '!**/*.test.ts' --glob '!**/*.integration.test.ts' \
    --glob '!**/test-purge.ts' --glob '!**/live-fixtures.ts' \
    || true
)"
if [[ -n "${SRC_HITS}" ]]; then
  echo "FAIL: production source enables purge GUCs:"; echo "${SRC_HITS}"; exit 1
fi
append_result '{"check":"browser_api_paths_no_purge","ok":true}'

echo "==> Config validation rejects ALLOW_TEST_PURGE in restricted envs"
for env_name in STAGING PILOT PRODUCTION; do
  set +e
  OUT="$(
    CONTRACTRADAR_ENV="${env_name}" ALLOW_DEV_DEFAULTS=false \
    ALLOW_TEST_PURGE=true \
    BETTER_AUTH_SECRET="$(python3 -c 'print("x"*48)')" \
    S3_ACCESS_KEY_ID=notdefault S3_SECRET_ACCESS_KEY=notdefaultsecret \
    DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="$(python3 -c 'print("t"*40)')" \
    MALWARE_SCANNER=clamav CLAMAV_HOST=clamav COOKIE_SECURE=true \
    DATABASE_MIGRATE_URL=postgresql://migrator:x@localhost/db \
    DATABASE_URL=postgresql://contractradar_app:x@localhost/db \
    CONNECTOR_PROVIDER=none NOTICE_DELIVERY_PROVIDER=none \
    pnpm --filter @contractradar/web exec tsx scripts/production-validate.ts 2>&1
  )"
  STATUS=$?
  set -e
  echo "${OUT}" | tee "${OUT_DIR}/test-purge-config-${env_name}.json" >/dev/null
  echo "${OUT}" | grep -q CFG_TEST_PURGE_ENABLED || { echo "missing CFG_TEST_PURGE_ENABLED for ${env_name}"; exit 1; }
  [[ "${STATUS}" -ne 0 ]] || { echo "validate should fail for ${env_name}"; exit 1; }
  append_result "{\"check\":\"config_reject_${env_name}\",\"ok\":true}"
done

echo "==> SQL layer: purge GUCs blocked under restricted app.contractradar_env"
for env_name in STAGING PILOT PRODUCTION; do
  set +e
  ERR="$(psql "${APP_URL}" -v ON_ERROR_STOP=1 <<SQL 2>&1
SELECT set_config('app.bypass_rls', 'on', false);
SELECT set_config('app.contractradar_env', '${env_name}', false);
SELECT set_config('app.allow_audit_purge', 'on', false);
SELECT reject_test_purge_outside_test_check();
SQL
)"
  STATUS=$?
  set -e
  if [[ "${STATUS}" -eq 0 ]]; then
    echo "FAIL: purge check allowed in ${env_name}"; echo "${ERR}"; exit 1
  fi
  echo "${ERR}" | grep -qi 'test purge' || { echo "unexpected error: ${ERR}"; exit 1; }
  detail="$(echo "${ERR}" | tr '\n' ' ' | sed 's/"/\\"/g' | head -c 200)"
  append_result "{\"check\":\"sql_reject_${env_name}\",\"ok\":true,\"detail\":\"${detail}\"}"
done

# Also probe other purge GUCs under PILOT for coverage of each mechanism family.
for guc in allow_ops_purge allow_notice_purge allow_deadline_purge allow_detection_purge allow_contract_revision_purge; do
  set +e
  ERR="$(psql "${APP_URL}" -v ON_ERROR_STOP=1 <<SQL 2>&1
SELECT set_config('app.contractradar_env', 'PILOT', false);
SELECT set_config('app.${guc}', 'on', false);
SELECT reject_test_purge_outside_test_check();
SQL
)"
  STATUS=$?
  set -e
  [[ "${STATUS}" -ne 0 ]] || { echo "FAIL: ${guc} allowed in PILOT"; exit 1; }
  append_result "{\"check\":\"sql_reject_pilot_${guc}\",\"ok\":true}"
done

echo "==> TEST/CI may enable narrowly scoped purge check without rejection"
psql "${APP_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT set_config('app.contractradar_env', 'TEST', false);
SELECT set_config('app.allow_audit_purge', 'on', false);
SELECT reject_test_purge_outside_test_check();
SQL
append_result '{"check":"test_env_allows_purge_guc_check","ok":true}'

echo "==> Runtime role is not superuser (cannot ALTER SYSTEM to enable purge)"
IS_SUPER="$(psql "${APP_URL}" -Atc 'SHOW is_superuser')"
echo "${IS_SUPER}" | grep -qiE 'off|false|no'
append_result '{"check":"runtime_role_not_superuser","ok":true}'

python3 - <<PY
import json, pathlib
out = pathlib.Path("${OUT_DIR}")
rows = []
for line in (out / "test-purge-results.ndjson").read_text().splitlines():
    if line.strip():
        rows.append(json.loads(line))
ok = all(r.get("ok") for r in rows) and len(rows) >= 10
doc = {
  "status": "PASS" if ok else "FAIL",
  "ok": ok,
  "checks": rows,
  "purgeGucs": [
    "app.allow_audit_purge",
    "app.allow_ops_purge",
    "app.allow_notice_purge",
    "app.allow_deadline_purge",
    "app.allow_detection_purge",
    "app.allow_contract_revision_purge",
  ],
  "notes": (
    "TEST/CI may use narrowly scoped purge helpers; STAGING/PILOT/PRODUCTION fail closed "
    "via CFG_TEST_PURGE_ENABLED + reject_test_purge_outside_test_check(). Synthetic CI only."
  ),
}
(out / "test-purge-safety-report.json").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
raise SystemExit(0 if ok else 1)
PY
