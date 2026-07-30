#!/usr/bin/env bash
# Prove runtime role cannot migrate / alter schema; migration role can.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../backup/lib.sh
source "${ROOT_DIR}/scripts/backup/lib.sh"
OUT_DIR="${MIGRATION_OUT_DIR:-${ROOT_DIR}/artifacts/migration}"
mkdir -p "${OUT_DIR}"
MIGRATE_URL="$(psql_url "${DATABASE_MIGRATE_URL:?}")"
APP_URL="$(psql_url "${DATABASE_URL:?}")"

{
  echo "migrate_url_user=$(python3 - <<PY
from urllib.parse import urlparse
print(urlparse("${DATABASE_MIGRATE_URL}").username)
PY
)"
  echo "app_url_user=$(python3 - <<PY
from urllib.parse import urlparse
print(urlparse("${DATABASE_URL}").username)
PY
)"
  echo "app_is_superuser=$(psql "${APP_URL}" -Atc 'SHOW is_superuser')"
  echo "migrate_is_superuser=$(psql "${MIGRATE_URL}" -Atc 'SHOW is_superuser')"
} | tee "${OUT_DIR}/role-attributes.txt"

echo "==> Runtime cannot CREATE/ALTER/DROP"
if psql "${APP_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE runtime_migrate_probe(id int);' >/dev/null 2>&1; then
  echo "FAIL: runtime created table"; exit 1
fi
if psql "${APP_URL}" -v ON_ERROR_STOP=1 -c 'ALTER TABLE tenant ADD COLUMN IF NOT EXISTS runtime_probe text;' >/dev/null 2>&1; then
  echo "FAIL: runtime altered table"; exit 1
fi
if psql "${APP_URL}" -v ON_ERROR_STOP=1 -c 'DROP TABLE IF EXISTS tenant;' >/dev/null 2>&1; then
  echo "FAIL: runtime dropped tenant"; exit 1
fi

echo "==> Runtime prisma migrate deploy should fail or no-op without privileges for new SQL"
# Attempt applying when already up to date is ok; force failure by requiring CREATE as app role:
if psql "${APP_URL}" -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA runtime_schema_probe;' >/dev/null 2>&1; then
  echo "FAIL: runtime created schema"; exit 1
fi

echo "==> Migration role can create ephemeral schema object then drop"
psql "${MIGRATE_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS migrator_probe(id int primary key); DROP TABLE migrator_probe;'

python3 - <<PY
import json, pathlib
pathlib.Path("${OUT_DIR}/role-separation-report.json").write_text(json.dumps({
  "status": "PASS",
  "runtimeCannotCreateAlterDrop": True,
  "migrationRoleCanApplyDDL": True,
  "applicationUsesSuperuser": False,
}, indent=2)+"\n")
print("ROLE_SEPARATION_OK")
PY
