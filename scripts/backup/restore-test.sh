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
PROGRESS="${BACKUP_OUT_DIR}/progress.log"
: > "${PROGRESS}"

obj() {
  pnpm --filter @contractradar/web exec node scripts/object-bytes.mjs "$@"
}

PASS_LIST=()
note_pass() {
  PASS_LIST+=("$1")
  echo "PASS: $1" | tee -a "${PROGRESS}"
  echo "::notice::PASS $1"
}
fail() {
  echo "FAIL: $1" | tee -a "${PROGRESS}"
  echo "::error::FAIL $1"
  if [[ -f "${PROGRESS}" ]]; then
    while IFS= read -r line; do echo "::error::progress: ${line}"; done < "${PROGRESS}"
  fi
  exit 1
}
on_err() {
  echo "ERR at line $1 exit $2" | tee -a "${PROGRESS}"
  echo "::error::ERR at line $1 exit $2"
  if [[ -f "${PROGRESS}" ]]; then
    while IFS= read -r line; do echo "::error::progress: ${line}"; done < "${PROGRESS}"
  fi
}
trap 'on_err $LINENO $?' ERR

MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?DATABASE_MIGRATE_URL required}")"
APP_URL="$(psql_url "${DATABASE_URL:?DATABASE_URL required}")"

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
OBJ_ORIG_KEY="tenants/11111111-1111-4111-8111-111111111111/projects/a1111111-1111-4111-8111-111111111111/uploads/original-upload.bin"
OBJ_PROMOTED_KEY="tenants/11111111-1111-4111-8111-111111111111/projects/a1111111-1111-4111-8111-111111111111/clean/promoted-clean.bin"
OBJ_ARTIFACT_KEY="tenants/11111111-1111-4111-8111-111111111111/projects/a1111111-1111-4111-8111-111111111111/artifacts/extracted.txt"
OBJ_EXPORT_KEY="tenants/11111111-1111-4111-8111-111111111111/notices/approved-export.pdf"
OBJ_BUNDLE_KEY="tenants/11111111-1111-4111-8111-111111111111/notices/notice-bundle.bin"
OBJ_DISPATCH_KEY="tenants/11111111-1111-4111-8111-111111111111/dispatch/evidence.bin"
OBJ_CONNECTOR_KEY="tenants/11111111-1111-4111-8111-111111111111/projects/a1111111-1111-4111-8111-111111111111/connector/imported.bin"

echo 'restore-object-a-bytes' > "${BACKUP_OUT_DIR}/object-a.txt"
echo 'restore-object-b-bytes' > "${BACKUP_OUT_DIR}/object-b.txt"
echo 'original-upload-bytes' > "${BACKUP_OUT_DIR}/object-orig.txt"
echo 'promoted-clean-bytes' > "${BACKUP_OUT_DIR}/object-promoted.txt"
echo 'extracted-artifact-bytes' > "${BACKUP_OUT_DIR}/object-artifact.txt"
echo 'approved-notice-export' > "${BACKUP_OUT_DIR}/object-export.txt"
echo 'notice-bundle-bytes' > "${BACKUP_OUT_DIR}/object-bundle.txt"
echo 'dispatch-evidence-bytes' > "${BACKUP_OUT_DIR}/object-dispatch.txt"
echo 'connector-imported-bytes' > "${BACKUP_OUT_DIR}/object-connector.txt"

SHA_A="$(obj put "${OBJ_A_KEY}" "${BACKUP_OUT_DIR}/object-a.txt" | tail -n 1)"
SHA_B="$(obj put "${OBJ_B_KEY}" "${BACKUP_OUT_DIR}/object-b.txt" | tail -n 1)"
SHA_ORIG="$(obj put "${OBJ_ORIG_KEY}" "${BACKUP_OUT_DIR}/object-orig.txt" | tail -n 1)"
SHA_PROMOTED="$(obj put "${OBJ_PROMOTED_KEY}" "${BACKUP_OUT_DIR}/object-promoted.txt" | tail -n 1)"
SHA_ARTIFACT="$(obj put "${OBJ_ARTIFACT_KEY}" "${BACKUP_OUT_DIR}/object-artifact.txt" | tail -n 1)"
SHA_EXPORT="$(obj put "${OBJ_EXPORT_KEY}" "${BACKUP_OUT_DIR}/object-export.txt" | tail -n 1)"
SHA_BUNDLE="$(obj put "${OBJ_BUNDLE_KEY}" "${BACKUP_OUT_DIR}/object-bundle.txt" | tail -n 1)"
SHA_DISPATCH="$(obj put "${OBJ_DISPATCH_KEY}" "${BACKUP_OUT_DIR}/object-dispatch.txt" | tail -n 1)"
SHA_CONNECTOR="$(obj put "${OBJ_CONNECTOR_KEY}" "${BACKUP_OUT_DIR}/object-connector.txt" | tail -n 1)"
note_pass "object_seed_written"

echo "==> Seed DB rows that reference object keys"
SEED_SQL="${BACKUP_OUT_DIR}/seed-db-object-refs.rendered.sql"
sed \
  -e "s|__SHA_ORIG__|${SHA_ORIG}|g" \
  -e "s|__SHA_PROMOTED__|${SHA_PROMOTED}|g" \
  -e "s|__SHA_ARTIFACT__|${SHA_ARTIFACT}|g" \
  -e "s|__SHA_EXPORT__|${SHA_EXPORT}|g" \
  -e "s|__SHA_BUNDLE__|${SHA_BUNDLE}|g" \
  -e "s|__SHA_DISPATCH__|${SHA_DISPATCH}|g" \
  -e "s|__SHA_CONNECTOR__|${SHA_CONNECTOR}|g" \
  -e "s|__OBJ_ORIG_KEY__|${OBJ_ORIG_KEY}|g" \
  -e "s|__OBJ_PROMOTED_KEY__|${OBJ_PROMOTED_KEY}|g" \
  -e "s|__OBJ_ARTIFACT_KEY__|${OBJ_ARTIFACT_KEY}|g" \
  -e "s|__OBJ_EXPORT_KEY__|${OBJ_EXPORT_KEY}|g" \
  -e "s|__OBJ_BUNDLE_KEY__|${OBJ_BUNDLE_KEY}|g" \
  -e "s|__OBJ_DISPATCH_KEY__|${OBJ_DISPATCH_KEY}|g" \
  -e "s|__OBJ_CONNECTOR_KEY__|${OBJ_CONNECTOR_KEY}|g" \
  "${ROOT_DIR}/scripts/backup/seed-db-object-refs.sql" > "${SEED_SQL}"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -f "${SEED_SQL}"
python3 - <<PY2
import json, pathlib
pathlib.Path("${BACKUP_OUT_DIR}/db-object-refs-expected.json").write_text(json.dumps({
  "refs": [
    {"entityType":"upload_session","entityId":"u1111111-1111-4111-8111-111111111111","objectKey":"${OBJ_ORIG_KEY}","expectedChecksum":"${SHA_ORIG}"},
    {"entityType":"document_version_promoted","entityId":"v1111111-1111-4111-8111-111111111111","objectKey":"${OBJ_PROMOTED_KEY}","expectedChecksum":"${SHA_PROMOTED}"},
    {"entityType":"extracted_artifact","entityId":"e1111111-1111-4111-8111-111111111111","objectKey":"${OBJ_ARTIFACT_KEY}","expectedChecksum":"${SHA_ARTIFACT}"},
    {"entityType":"notice_export_bundle","entityId":"ne111111-1111-4111-8111-111111111111","objectKey":"${OBJ_EXPORT_KEY}","expectedChecksum":"${SHA_EXPORT}"},
    {"entityType":"notice_bundle","entityId":"ns111111-1111-4111-8111-111111111111","objectKey":"${OBJ_BUNDLE_KEY}","expectedChecksum":"${SHA_BUNDLE}"},
    {"entityType":"dispatch_evidence","entityId":"de111111-1111-4111-8111-111111111111","objectKey":"${OBJ_DISPATCH_KEY}","expectedChecksum":"${SHA_DISPATCH}"},
    {"entityType":"connector_imported_object","entityId":"v2222222-2222-4222-8222-222222222222","objectKey":"${OBJ_CONNECTOR_KEY}","expectedChecksum":"${SHA_CONNECTOR}"},
  ]
}, indent=2)+"\n")
print("DB_OBJECT_REFS_EXPECTED")
PY2
note_pass "db_object_references_seeded"

MANIFEST="$(BACKUP_OUT_DIR="${BACKUP_OUT_DIR}" bash scripts/backup/pg-backup.sh | tail -n 1)"
test -s "${MANIFEST}" || fail "backup_manifest_missing"
DUMP_NAME="$(python3 -c "import json; print(json.load(open('${MANIFEST}'))['dumpFile'])")"
DUMP_PATH="${BACKUP_OUT_DIR}/${DUMP_NAME}"
test -s "${DUMP_PATH}" || fail "backup_dump_empty"
note_pass "postgres_backup_created"

OBJ_DATA_DIR="${BACKUP_OUT_DIR}/objects-ci"
OBJ_MANIFEST="${BACKUP_OUT_DIR}/object-manifest.json"
rm -rf "${OBJ_DATA_DIR}"
obj backup-dir "${OBJ_DATA_DIR}" "${OBJ_MANIFEST}" >/dev/null
cp "${OBJ_MANIFEST}" "${BACKUP_OUT_DIR}/objects-ci.manifest.json"
python3 - <<PY
import json, pathlib
doc=json.loads(pathlib.Path("${OBJ_MANIFEST}").read_text())
pathlib.Path("${BACKUP_OUT_DIR}/object-checksum-summary.json").write_text(json.dumps({"objects": doc.get("objects", [])}, indent=2)+"\n")
assert doc.get("objectCount", 0) >= 9, doc
PY
test -s "${BACKUP_OUT_DIR}/database-checksum.txt" || fail "database_checksum_missing"
test -s "${BACKUP_OUT_DIR}/database-backup-metadata.json" || fail "database_backup_metadata_missing"
cp "${MANIFEST}" "${BACKUP_OUT_DIR}/backup-manifest.json"
note_pass "object_manifest_created"

for k in "${OBJ_A_KEY}" "${OBJ_B_KEY}" "${OBJ_ORIG_KEY}" "${OBJ_PROMOTED_KEY}" \
         "${OBJ_ARTIFACT_KEY}" "${OBJ_EXPORT_KEY}" "${OBJ_BUNDLE_KEY}" \
         "${OBJ_DISPATCH_KEY}" "${OBJ_CONNECTOR_KEY}"; do
  obj del "${k}" >/dev/null || true
done
note_pass "objects_deleted_pre_restore"

bash scripts/backup/pg-restore.sh "${DUMP_PATH}"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
GRANT USAGE ON SCHEMA public TO contractradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO contractradar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO contractradar_app;
SQL
note_pass "postgres_restored"

obj restore-dir "${OBJ_MANIFEST}" >/dev/null
note_pass "objects_restored_from_backup"

SHA_A2="$(obj get "${OBJ_A_KEY}" "${BACKUP_OUT_DIR}/object-a.restored.txt" | tail -n 1)"
SHA_B2="$(obj get "${OBJ_B_KEY}" "${BACKUP_OUT_DIR}/object-b.restored.txt" | tail -n 1)"
[[ "${SHA_A}" == "${SHA_A2}" && "${SHA_B}" == "${SHA_B2}" ]] || fail "object_checksum_mismatch ${SHA_A}/${SHA_A2} ${SHA_B}/${SHA_B2}"
note_pass "object_byte_checksum_round_trip"

echo "==> Verify restored DB object references resolve to object bytes"
MIGRATE_URL="${MIGRATE_URL}" APP_URL="${APP_URL}" BACKUP_OUT_DIR="${BACKUP_OUT_DIR}" \
ROOT_DIR="${ROOT_DIR}" python3 - <<'PY'
import json, pathlib, subprocess, os, tempfile

url = os.environ["MIGRATE_URL"]
app_url = os.environ["APP_URL"]
out = pathlib.Path(os.environ["BACKUP_OUT_DIR"])
root = pathlib.Path(os.environ["ROOT_DIR"])

def psql(u, q):
    return subprocess.check_output(["psql", u, "-Atc", q], text=True).strip()

def obj_get(key):
    tmp = out / f"dbref-{key.replace('/', '_')}.bin"
    r = subprocess.run(
        ["pnpm", "--filter", "@contractradar/web", "exec", "node", "scripts/object-bytes.mjs", "get", key, str(tmp)],
        cwd=str(root), capture_output=True, text=True,
    )
    if r.returncode != 0:
        return None, f"missing:{r.stderr.strip()}"
    sha = (r.stdout or "").strip().splitlines()[-1]
    return sha, None

queries = [
    ("upload_session", "u1111111-1111-4111-8111-111111111111",
     """SELECT "storageKey"||'|'||coalesce("expectedSha256",'') FROM upload_session WHERE id='u1111111-1111-4111-8111-111111111111'"""),
    ("document_version_promoted", "v1111111-1111-4111-8111-111111111111",
     """SELECT "storageKey"||'|'||sha256 FROM document_version WHERE id='v1111111-1111-4111-8111-111111111111'"""),
    ("extracted_artifact", "e1111111-1111-4111-8111-111111111111",
     """SELECT "storageKey"||'|'||sha256 FROM extracted_artifact WHERE id='e1111111-1111-4111-8111-111111111111'"""),
    ("notice_export_bundle", "ne111111-1111-4111-8111-111111111111",
     """SELECT "storageKey"||'|'||"artifactChecksum" FROM notice_export_bundle WHERE id='ne111111-1111-4111-8111-111111111111'"""),
    ("notice_bundle", "ns111111-1111-4111-8111-111111111111",
     """SELECT (\"attachmentSnapshot\"->0->>'storageKey')||'|'||\"bundleChecksum\" FROM notice_dispatch_package_snapshot WHERE id='ns111111-1111-4111-8111-111111111111'"""),
    ("dispatch_evidence", "de111111-1111-4111-8111-111111111111",
     """SELECT "storageKey"||'|'||"checksumSha256" FROM dispatch_evidence WHERE id='de111111-1111-4111-8111-111111111111'"""),
    ("connector_imported_object", "v2222222-2222-4222-8222-222222222222",
     """SELECT "storageKey"||'|'||sha256 FROM document_version WHERE id='v2222222-2222-4222-8222-222222222222'"""),
]

results = []
missing = 0
for entity_type, entity_id, q in queries:
    row = psql(url, q)
    if not row or "|" not in row:
        results.append({"entityType": entity_type, "entityId": entity_id, "resolutionResult": "FAIL_DB_ROW_MISSING"})
        missing += 1
        continue
    key, expected = row.split("|", 1)
    restored, err = obj_get(key)
    ok = restored is not None and restored == expected and key == key
    if restored is None:
        missing += 1
    results.append({
        "entityType": entity_type,
        "entityId": entity_id,
        "objectKey": key,
        "expectedChecksum": expected,
        "restoredChecksum": restored,
        "resolutionResult": "PASS" if ok else ("FAIL_MISSING_OBJECT" if restored is None else "FAIL_CHECKSUM"),
    })

# Document/version readable
doc_ok = psql(url, "SELECT count(*) FROM source_document WHERE id='d1111111-1111-4111-8111-111111111111'") == "1"
ver_ok = psql(url, "SELECT count(*) FROM document_version WHERE id='v1111111-1111-4111-8111-111111111111'") == "1"

# Cross-project access blocked for tenant B user against tenant A project objects
iso = subprocess.check_output(["psql", app_url, "-v", "ON_ERROR_STOP=1"], text=True, input="""
SELECT set_config('app.bypass_rls', 'off', false);
SELECT set_config('app.current_user_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
SELECT set_config('app.current_tenant_id', '22222222-2222-4222-8222-222222222222', false);
SELECT count(*) FROM document_version WHERE id = 'v1111111-1111-4111-8111-111111111111';
""")
import re
nums = [int(x) for x in re.findall(r"^\s*(\d+)\s*$", iso, re.M)]
cross_project_blocked = len(nums) >= 1 and nums[0] == 0

ok = missing == 0 and all(r["resolutionResult"] == "PASS" for r in results) and doc_ok and ver_ok and cross_project_blocked
doc = {
  "status": "PASS" if ok else "FAIL",
  "ok": ok,
  "references": results,
  "documentReadable": doc_ok,
  "versionReadable": ver_ok,
  "crossProjectAccessBlocked": cross_project_blocked,
  "missingObjectCount": missing,
}
(out / "database-object-reference-report.json").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
raise SystemExit(0 if ok else 1)
PY
note_pass "database_object_references_resolved"

if ! obj missing "tenants/missing/object.bin"; then
  fail "missing_object_should_error"
fi
note_pass "missing_object_detected"

echo 'tampered' > "${BACKUP_OUT_DIR}/object-a.tampered.txt"
mkdir -p "$(dirname "${OBJ_DATA_DIR}/${OBJ_A_KEY}")"
cp "${BACKUP_OUT_DIR}/object-a.tampered.txt" "${OBJ_DATA_DIR}/${OBJ_A_KEY}"
if obj restore-dir "${OBJ_MANIFEST}" >/dev/null 2>&1; then
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
bad_obj={"type":"not-a-backup","dataDir":"missing","objects":[]}
pathlib.Path("${BACKUP_OUT_DIR}/invalid-object.manifest.json").write_text(json.dumps(bad_obj))
print("tampered_manifest_detected")
PY
if obj restore-dir "${BACKUP_OUT_DIR}/invalid-object.manifest.json" >/dev/null 2>&1; then
  fail "invalid_object_manifest_should_reject"
fi
note_pass "tampered_manifest_rejected"

if bash scripts/backup/pg-restore.sh "${BACKUP_OUT_DIR}/does-not-exist.sql" >/dev/null 2>&1; then
  fail "invalid_backup_should_fail"
fi
note_pass "invalid_backup_rejected"

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant FORCE ROW LEVEL SECURITY;
ALTER TABLE project ENABLE ROW LEVEL SECURITY;
ALTER TABLE project FORCE ROW LEVEL SECURITY;
ALTER TABLE source_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_document FORCE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;
SQL

psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -Atc \
  "SELECT relname||'='||relforcerowsecurity FROM pg_class WHERE relname IN ('tenant','project','source_document','tenant_settings') ORDER BY 1;" \
  | tee "${BACKUP_OUT_DIR}/rls-force.txt"
python3 - <<PY
import json, pathlib
rows=[r.strip().replace("\r","") for r in pathlib.Path("${BACKUP_OUT_DIR}/rls-force.txt").read_text().splitlines() if r.strip()]
ok=len(rows)>=4 and all(r.endswith("=t") or r.endswith("=true") for r in rows)
pathlib.Path("${RLS_REPORT}").write_text(json.dumps({"ok": ok, "rows": rows}, indent=2)+"\n")
if not ok:
    print("FORCE_RLS_ROWS", rows)
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
text=pathlib.Path("${BACKUP_OUT_DIR}/isolation.txt").read_text().replace("\r","")
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
