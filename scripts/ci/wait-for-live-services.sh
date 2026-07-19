#!/usr/bin/env bash
# Bounded health waits for Mode B CI data plane. Fail with safe diagnostics.
set -euo pipefail

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-contractradar}"
PGDATABASE="${PGDATABASE:-contractradar_test}"
REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}"
CLAMAV_HOST="${CLAMAV_HOST:-127.0.0.1}"
CLAMAV_PORT="${CLAMAV_PORT:-3310}"
DI_URL="${DOCUMENT_INTELLIGENCE_URL:-http://127.0.0.1:8000}"
INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN:-}"

wait_tcp() {
  local host="$1" port="$2" name="$3" attempts="${4:-60}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if (echo >"/dev/tcp/${host}/${port}") >/dev/null 2>&1; then
      echo "OK ${name} tcp ${host}:${port}"
      return 0
    fi
    sleep 2
  done
  echo "FAIL ${name} did not accept TCP on ${host}:${port}"
  return 1
}

wait_http() {
  local url="$1" name="$2" attempts="${3:-60}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if curl -fsS --max-time 3 "${url}" >/dev/null 2>&1; then
      echo "OK ${name} ${url}"
      return 0
    fi
    sleep 2
  done
  echo "FAIL ${name} HTTP check failed for ${url}"
  return 1
}

echo "Waiting for PostgreSQL..."
wait_tcp "${PGHOST}" "${PGPORT}" "postgres" 45
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}"
fi

echo "Waiting for Redis..."
if command -v redis-cli >/dev/null 2>&1; then
  for i in $(seq 1 30); do
    if redis-cli -u "${REDIS_URL}" ping 2>/dev/null | grep -q PONG; then
      echo "OK redis ping"
      break
    fi
    sleep 2
    if [[ "${i}" -eq 30 ]]; then
      echo "FAIL redis ping"
      exit 1
    fi
  done
else
  wait_tcp 127.0.0.1 6379 "redis" 30
fi

echo "Waiting for MinIO..."
wait_http "${S3_ENDPOINT%/}/minio/health/live" "minio" 45

echo "Waiting for ClamAV (signature DB may take minutes on first pull)..."
# Prefer clamdscan --ping inside sidecar when present; do not treat "container running" as ready.
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'contractradar-ci-clamav'; then
  for i in $(seq 1 90); do
    if docker exec contractradar-ci-clamav clamdscan --ping 3 >/dev/null 2>&1; then
      echo "OK clamav clamdscan --ping"
      break
    fi
    sleep 2
    if [[ "${i}" -eq 90 ]]; then
      echo "FAIL clamav clamdscan --ping"
      docker ps -a --filter name=contractradar-ci-clamav --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
      exit 1
    fi
  done
else
  wait_tcp "${CLAMAV_HOST}" "${CLAMAV_PORT}" "clamav" 90
fi

if [[ -n "${INTERNAL_TOKEN}" ]]; then
  echo "Waiting for document-intelligence ready..."
  for i in $(seq 1 45); do
    code="$(curl -sS -o /tmp/di-ready.json -w '%{http_code}' \
      -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
      "${DI_URL%/}/health/ready" || true)"
    if [[ "${code}" == "200" ]] && grep -q '"status":"ok"' /tmp/di-ready.json 2>/dev/null; then
      echo "OK document-intelligence ready"
      # Never print full ready body if it somehow included secrets (it shouldn't).
      python3 - <<'PY'
import json
from pathlib import Path
body = json.loads(Path("/tmp/di-ready.json").read_text())
safe = {"status": body.get("status"), "checks": {k: {"status": v.get("status")} for k, v in (body.get("checks") or {}).items()}}
print(json.dumps(safe))
PY
      break
    fi
    sleep 2
    if [[ "${i}" -eq 45 ]]; then
      echo "FAIL document-intelligence readiness"
      if [[ -f /tmp/di-api.log ]]; then tail -n 80 /tmp/di-api.log | sed -E 's/(token|secret|password)=[^ ]+/\\1=REDACTED/gi'; fi
      exit 1
    fi
  done
else
  wait_http "${DI_URL%/}/health/live" "document-intelligence-live" 45
fi

echo "All required live services reported healthy."
