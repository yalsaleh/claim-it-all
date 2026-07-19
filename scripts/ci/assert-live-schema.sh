#!/usr/bin/env bash
# Fail closed if CI schema/RLS/grants are missing for live ingestion.
set -euo pipefail

RAW_URL="${DATABASE_MIGRATE_URL:-${DATABASE_URL:-}}"
if [[ -z "${RAW_URL}" ]]; then
  echo "ERROR: DATABASE_MIGRATE_URL or DATABASE_URL required"
  exit 1
fi

# Strip prisma schema query param for psql.
PSQL_URL="$(
  DATABASE_URL="${RAW_URL}" python3 - <<'PY'
import os
from urllib.parse import urlparse, urlunparse
u = urlparse(os.environ["DATABASE_URL"])
kept = "&".join(p for p in (u.query or "").split("&") if p and not p.lower().startswith("schema="))
print(urlunparse(u._replace(query=kept)))
PY
)"
export DATABASE_URL="${PSQL_URL}"

echo "Asserting live schema (outbox_event, RLS, grants)..."
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 <<'SQL'
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'outbox_event'
) THEN 'ok' ELSE 'missing' END AS outbox_table;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'outbox_event'
ORDER BY ordinal_position;

SELECT polname, polcmd
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
WHERE relname = 'outbox_event';

SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'outbox_event' AND grantee = 'contractradar_app';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbox_event'
  ) THEN
    RAISE EXCEPTION 'outbox_event table missing — migrations not applied';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname = 'outbox_event'
  ) THEN
    RAISE EXCEPTION 'outbox_event RLS policy missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_name = 'outbox_event'
      AND grantee = 'contractradar_app'
      AND privilege_type = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'contractradar_app lacks INSERT on outbox_event';
  END IF;
END $$;
SQL

echo "OK live schema assertions passed"
