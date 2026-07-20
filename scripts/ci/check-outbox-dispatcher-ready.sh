#!/usr/bin/env bash
# Prove outbox dispatcher can query Postgres + Redis (not merely PID alive).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}/services/document-intelligence"

export APP_ENV="${APP_ENV:-test}"
export ALLOW_DEV_DEFAULTS="${ALLOW_DEV_DEFAULTS:-true}"
export ARQ_QUEUE_NAME="${ARQ_QUEUE_NAME:-contractradar:document-processing}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN:?token required}"

PID_FILE="${OUTBOX_PID_FILE:-/tmp/outbox.pid}"
LOG_FILE="${OUTBOX_LOG:-/tmp/outbox.log}"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "FAIL: outbox dispatcher pid file missing (${PID_FILE})"
  tail -n 80 "${LOG_FILE}" 2>/dev/null || true
  exit 1
fi
PID="$(cat "${PID_FILE}")"
if ! kill -0 "${PID}" 2>/dev/null; then
  echo "FAIL: outbox dispatcher pid ${PID} is not alive"
  tail -n 120 "${LOG_FILE}" 2>/dev/null || true
  exit 1
fi
echo "OK outbox dispatcher pid=${PID} alive"

# Functional readiness: DB query + timestamp bind + Redis + heartbeat.
python -m document_intelligence.outbox.readiness
echo "OK outbox dispatcher readiness probe passed"

# Heartbeat must be present after a successful poll from the running process soon.
# Give the live loop one poll interval to refresh heartbeat as well.
python - <<'PY'
import asyncio
import os
import sys
import time

from document_intelligence.config import reset_settings_cache
from document_intelligence.outbox.dispatcher import read_heartbeat

reset_settings_cache()

async def main() -> int:
    deadline = time.time() + 15
    while time.time() < deadline:
        hb = await read_heartbeat()
        if hb:
            print("OK dispatcher heartbeat", {k: hb.get(k) for k in ("ts", "arq_queue_name", "claimed", "readiness")})
            return 0
        await asyncio.sleep(0.5)
    print("FAIL: dispatcher heartbeat missing after readiness")
    return 1

sys.exit(asyncio.run(main()))
PY

# Surface recent dispatcher errors if any (sanitized by absence of secrets in logger).
if grep -Eiq 'outbox_loop_error|outbox_dispatcher_terminal' "${LOG_FILE}" 2>/dev/null; then
  echo "WARN: dispatcher log contains loop errors (showing last matches):"
  grep -E 'outbox_loop_error|outbox_dispatcher_terminal|exception_class|sqlstate' "${LOG_FILE}" | tail -n 20 || true
fi
