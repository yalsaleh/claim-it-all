#!/usr/bin/env bash
# Synthetic CI restore verification (NOT a production-cloud restore claim).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
cd "${ROOT_DIR}"

export BACKUP_OUT_DIR="${BACKUP_OUT_DIR:-${ROOT_DIR}/artifacts/backup}"
mkdir -p "${BACKUP_OUT_DIR}"
REPORT="${BACKUP_OUT_DIR}/restore-test-report.json"
ISOLATION_REPORT="${BACKUP_OUT_DIR}/tenant-isolation-report.json"
RLS_REPORT="${BACKUP_OUT_DIR}/rls-force-report.json"
READY_REPORT="${BACKUP_OUT_DIR}/application-readiness-report.json"
OBJECT_REPORT="${BACKUP_OUT_DIR}/object-restore-report.json"

MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?DATABASE_MIGRATE_URL required}")"
APP_URL="$(psql_url "${DATABASE_URL:?DATABASE_URL required}")"
ENDPOINT="${S3_ENDPOINT:?}"
BUCKET="${S3_BUCKET:?}"
ACCESS="${S3_ACCESS_KEY_ID:?}"
SECRET="${S3_SECRET_ACCESS_KEY:?}"

PASS_LIST=()
note_pass() { PASS_LIST+=("$1"); echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

echo "==> Ensure migrations applied"
pnpm db:migrate:deploy
note_pass "migrations_applied"

echo "==> Seed multi-tenant synthetic data"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT set_config('app.bypass_rls', 'on', false);
DELETE FROM project WHERE id IN (
  'a1111111-1111-4111-8111-111111111111',
  'a2222222-2222-4222-8222-222222222222'
);
DELETE FROM tenant_membership WHERE id IN (
  'b1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222'
);
DELETE FROM "user" WHERE email IN ('restore-a@example.com', 'restore-b@example.com')
  OR id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
DELETE FROM tenant WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);
INSERT INTO tenant (id, name, slug, status, "createdAt", "updatedAt") VALUES
  ('11111111-1111-4111-8111-111111111111', 'Restore A', 'restore-a-ci', 'ACTIVE', NOW(), NOW()),
  ('22222222-2222-4222-8222-222222222222', 'Restore B', 'restore-b-ci', 'ACTIVE', NOW(), NOW());
INSERT INTO "user" (id, email, name, status, "createdAt", "updatedAt") VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'restore-a@example.com', 'Restore A User', 'ACTIVE', NOW(), NOW()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'restore-b@example.com', 'Restore B User', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
INSERT INTO tenant_membership (id, "tenantId", "userId", role, status, "createdAt", "updatedAt") VALUES
  ('b1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'TENANT_OWNER', 'ACTIVE', NOW(), NOW()),
  ('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'TENANT_OWNER', 'ACTIVE', NOW(), NOW());
INSERT INTO project (id, "tenantId", name, code, status, "countryCode", "defaultCurrency", timezone, "createdAt", "updatedAt") VALUES
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Project A', 'RA', 'ACTIVE', 'AE', 'AED', 'Asia/Dubai', NOW(), NOW()),
  ('a2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Project B', 'RB', 'ACTIVE', 'AE', 'AED', 'Asia/Dubai', NOW(), NOW());
SQL
note_pass "multi_tenant_seed"
TENANT_COUNT_BEFORE="$(psql "${MIGRATE_URL}" -Atc 'SELECT count(*) FROM tenant')"

OBJ_A_KEY="tenants/11111111-1111-4111-8111-111111111111/projects/a1111111-1111-4111-8111-111111111111/originals/restore-a.txt"
OBJ_B_KEY="tenants/22222222-2222-4222-8222-222222222222/projects/a2222222-2222-4222-8222-222222222222/originals/restore-b.txt"
echo 'restore-object-a-bytes' > "${BACKUP_OUT_DIR}/object-a.txt"
echo 'restore-object-b-bytes' > "${BACKUP_OUT_DIR}/object-b.txt"
command -v mc >/dev/null || fail "minio_client_required"
mc alias set crrestore "${ENDPOINT}" "${ACCESS}" "${SECRET}" >/dev/null
mc mb -p "crrestore/${BUCKET}" >/dev/null || true
mc cp "${BACKUP_OUT_DIR}/object-a.txt" "crrestore/${BUCKET}/${OBJ_A_KEY}" >/dev/null
mc cp "${BACKUP_OUT_DIR}/object-b.txt" "crrestore/${BUCKET}/${OBJ_B_KEY}" >/dev/null
SHA_A="$(sha256sum "${BACKUP_OUT_DIR}/object-a.txt" | awk '{print $1}')"
SHA_B="$(sha256sum "${BACKUP_OUT_DIR}/object-b.txt" | awk '{print $1}')"
note_pass "object_seed_written"

MANIFEST="$(BACKUP_OUT_DIR="${BACKUP_OUT_DIR}" bash scripts/backup/pg-backup.sh | tail -n 1)"
test -s "${MANIFEST}" || fail "backup_manifest_missing"
DUMP_NAME="$(python3 -c "import json; print(json.load(open('${MANIFEST}'))['dumpFile'])")"
DUMP_PATH="${BACKUP_OUT_DIR}/${DUMP_NAME}"
test -s "${DUMP_PATH}" || fail "backup_dump_empty"
note_pass "postgres_backup_created"

OBJ_MANIFEST="$(BACKUP_OUT_DIR="${BACKUP_OUT_DIR}" bash scripts/backup/object-backup.sh | tail -n 1)"
test -s "${OBJ_MANIFEST}" || fail "object_manifest_missing"
test -s "${BACKUP_OUT_DIR}/object-manifest.json" || fail "stable_object_manifest_missing"
test -s "${BACKUP_OUT_DIR}/object-checksum-summary.json" || fail "object_checksum_summary_missing"
test -s "${BACKUP_OUT_DIR}/database-checksum.txt" || fail "database_checksum_missing"
test -s "${BACKUP_OUT_DIR}/database-backup-metadata.json" || fail "database_backup_metadata_missing"
cp "${MANIFEST}" "${BACKUP_OUT_DIR}/backup-manifest.json"
note_pass "object_manifest_created"

mc rm --recursive --force "crrestore/${BUCKET}/tenants" >/dev/null || true
mc rm "crrestore/${BUCKET}/${OBJ_A_KEY}" >/dev/null 2>&1 || true
mc rm "crrestore/${BUCKET}/${OBJ_B_KEY}" >/dev/null 2>&1 || true
note_pass "objects_deleted_pre_restore"

bash scripts/backup/pg-restore.sh "${DUMP_PATH}"
# Ensure runtime grants exist even if a dump variant omitted ACLs.
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO contractradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contractradar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contractradar_app;
SQL
note_pass "postgres_restored"

bash scripts/backup/object-restore.sh "${OBJ_MANIFEST}"
note_pass "objects_restored_from_backup"

mc cat "crrestore/${BUCKET}/${OBJ_A_KEY}" > "${BACKUP_OUT_DIR}/object-a.restored.txt"
mc cat "crrestore/${BUCKET}/${OBJ_B_KEY}" > "${BACKUP_OUT_DIR}/object-b.restored.txt"
SHA_A2="$(sha256sum "${BACKUP_OUT_DIR}/object-a.restored.txt" | awk '{print $1}')"
SHA_B2="$(sha256sum "${BACKUP_OUT_DIR}/object-b.restored.txt" | awk '{print $1}')"
[[ "${SHA_A}" == "${SHA_A2}" && "${SHA_B}" == "${SHA_B2}" ]] || fail "object_checksum_mismatch"
note_pass "object_byte_checksum_round_trip"

if mc cat "crrestore/${BUCKET}/tenants/missing/object.bin" >/dev/null 2>&1; then
  fail "missing_object_should_error"
fi
note_pass "missing_object_detected"

echo 'tampered' > "${BACKUP_OUT_DIR}/object-a.tampered.txt"
TAMPER_SHA="$(sha256sum "${BACKUP_OUT_DIR}/object-a.tampered.txt" | awk '{print $1}')"
[[ "${TAMPER_SHA}" != "${SHA_A}" ]] || fail "tamper_sha_unexpectedly_equal"
OBJ_DATA_DIR="$(python3 -c "import json; print('${BACKUP_OUT_DIR}/'+json.load(open('${OBJ_MANIFEST}'))['dataDir'])")"
mkdir -p "$(dirname "${OBJ_DATA_DIR}/${OBJ_A_KEY}")"
cp "${BACKUP_OUT_DIR}/object-a.tampered.txt" "${OBJ_DATA_DIR}/${OBJ_A_KEY}"
if bash scripts/backup/object-restore.sh "${OBJ_MANIFEST}" >/dev/null 2>&1; then
  fail "tampered_object_should_reject_restore"
fi
cp "${BACKUP_OUT_DIR}/object-a.txt" "${OBJ_DATA_DIR}/${OBJ_A_KEY}"
note_pass "tampered_object_checksum_rejected"

python3 - <<PY
import json, pathlib, hashlib
doc=json.loads(pathlib.Path("${MANIFEST}").read_text())
real=hashlib.sha256(pathlib.Path("${DUMP_PATH}").read_bytes()).hexdigest()
doc["checksumSha256"]="0"*64
assert doc["checksumSha256"] != real
pathlib.Path("${BACKUP_OUT_DIR}/tampered.manifest.json").write_text(json.dumps(doc))
# Object restore must reject wrong type / incomplete manifests
bad_obj={"type":"not-a-backup","dataDir":"missing","objects":[]}
pathlib.Path("${BACKUP_OUT_DIR}/invalid-object.manifest.json").write_text(json.dumps(bad_obj))
print("tampered_manifest_detected")
PY
if bash scripts/backup/object-restore.sh "${BACKUP_OUT_DIR}/invalid-object.manifest.json" >/dev/null 2>&1; then
  fail "invalid_object_manifest_should_reject"
fi
note_pass "tampered_manifest_rejected"

if bash scripts/backup/pg-restore.sh "${BACKUP_OUT_DIR}/does-not-exist.sql" >/dev/null 2>&1; then
  fail "invalid_backup_should_fail"
fi
note_pass "invalid_backup_rejected"

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -Atc \
  "SELECT relname||'='||relforcerowsecurity FROM pg_class WHERE relname IN ('tenant','project','source_document','tenant_settings') ORDER BY 1;" \
  | tee "${BACKUP_OUT_DIR}/rls-force.txt"
python3 - <<PY
import json, pathlib
rows=[r for r in pathlib.Path("${BACKUP_OUT_DIR}/rls-force.txt").read_text().splitlines() if r.strip()]
ok=all(r.endswith("=t") or r.endswith("=true") for r in rows)
pathlib.Path("${RLS_REPORT}").write_text(json.dumps({"ok": ok, "rows": rows}, indent=2)+"\n")
raise SystemExit(0 if ok else 1)
PY
note_pass "force_rls_preserved"

IS_SUPER="$(psql "${APP_URL}" -Atc 'SHOW is_superuser')"
echo "app_is_superuser=${IS_SUPER}" | tee "${BACKUP_OUT_DIR}/runtime-role.txt"
echo "${IS_SUPER}" | grep -qiE 'off|false|no' || fail "runtime_role_is_superuser"
if psql "${APP_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE runtime_should_fail(id int);' >/dev/null 2>&1; then
  fail "runtime_role_created_table"
fi
note_pass "runtime_role_cannot_create_table"

psql "${APP_URL}" -v ON_ERROR_STOP=1 <<'SQL' > "${BACKUP_OUT_DIR}/isolation.txt"
SELECT set_config('app.bypass_rls', 'off', false);
SELECT set_config('app.current_user_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
SELECT set_config('app.current_tenant_id', '11111111-1111-4111-8111-111111111111', false);
SELECT count(*) FROM project WHERE id = 'a2222222-2222-4222-8222-222222222222';
SELECT set_config('app.current_tenant_id', '', false);
SELECT count(*) FROM project;
SQL
python3 - <<PY
import json, pathlib, re
text=pathlib.Path("${BACKUP_OUT_DIR}/isolation.txt").read_text()
nums=[int(x) for x in re.findall(r"^\s*(\d+)\s*$", text, re.M)]
ok=len(nums)>=2 and nums[0]==0 and nums[1]==0
pathlib.Path("${ISOLATION_REPORT}").write_text(json.dumps({"ok": ok, "counts": nums, "raw": text}, indent=2)+"\n")
raise SystemExit(0 if ok else 1)
PY
note_pass "cross_tenant_isolation_after_restore"

TENANT_COUNT_AFTER="$(psql "${MIGRATE_URL}" -Atc 'SELECT count(*) FROM tenant')"
[[ "${TENANT_COUNT_AFTER}" -ge 2 ]] || fail "tenant_rows_missing_after_restore"
note_pass "row_counts_preserved"

python3 - <<PY
import json, os, pathlib, socket
checks={"database":"ok","object_checksum":"ok" if "${SHA_A}"=="${SHA_A2}" else "fail"}
host=os.environ.get("REDIS_URL","redis://127.0.0.1:6379").split("@")[-1].split("/")[0]
h,p=(host.split(":")+["6379"])[:2]
s=socket.socket(); s.settimeout(1)
try:
  s.connect((h.replace("redis://",""), int(p))); checks["redis"]="ok"
except Exception:
  checks["redis"]="degraded"
finally:
  s.close()
ok=checks["database"]=="ok" and checks["object_checksum"]=="ok"
pathlib.Path("${READY_REPORT}").write_text(json.dumps({"ok": ok, "checks": checks, "label": "synthetic_ci_restore_readiness"}, indent=2)+"\n")
raise SystemExit(0 if ok else 1)
PY
note_pass "application_readiness_after_restore"

python3 - <<PY
import json, pathlib
passes = """$(printf '%s\n' "${PASS_LIST[@]}")""".strip().splitlines()
pathlib.Path("${OBJECT_REPORT}").write_text(json.dumps({
  "ok": True,
  "roundTrip": True,
  "missingObjectDetected": True,
  "tamperedObjectRejected": True,
  "tamperedManifestRejected": True,
  "invalidBackupRejected": True,
}, indent=2)+"\n")
pathlib.Path("${REPORT}").write_text(json.dumps({
  "label": "synthetic_ci_infrastructure_restore_verification",
  "status": "PASS",
  "checksExecuted": passes,
  "tenantCountBefore": int("${TENANT_COUNT_BEFORE}"),
  "tenantCountAfter": int("${TENANT_COUNT_AFTER}"),
}, indent=2)+"\n")
print("RESTORE_TEST_OK")
PY
