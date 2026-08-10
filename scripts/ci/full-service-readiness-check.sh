#!/usr/bin/env bash
# Production-readiness: start synthetic data plane and verify full live dependency readiness.
# Reuses Live ingestion scripts; does NOT claim cloud deploy or real providers.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${PROD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/production-readiness}"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/sidecar-helpers.sh"

export START_CLAMAV="${START_CLAMAV:-true}"
export MALWARE_SCANNER="${MALWARE_SCANNER:-clamav}"
export CLAMAV_HOST="${CLAMAV_HOST:-127.0.0.1}"
export CLAMAV_PORT="${CLAMAV_PORT:-3310}"
export DOCUMENT_INTELLIGENCE_URL="${DOCUMENT_INTELLIGENCE_URL:-http://127.0.0.1:8000}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}"
export ARQ_QUEUE_NAME="${ARQ_QUEUE_NAME:-contractradar:document-processing}"

echo "==> Ensure MinIO + ClamAV sidecars"
chmod +x scripts/ci/start-live-sidecars.sh scripts/ci/stop-live-sidecars.sh
bash scripts/ci/start-live-sidecars.sh

echo "==> Start DI API + ARQ worker + outbox dispatcher"
(
  cd services/document-intelligence
  if [[ ! -x .venv-ci-pr/bin/python ]]; then
    python3 -m venv .venv-ci-pr
    .venv-ci-pr/bin/pip install -q -U pip
    .venv-ci-pr/bin/pip install -q -e ".[dev]"
  fi
)
export PATH="${ROOT_DIR}/services/document-intelligence/.venv-ci-pr/bin:${PATH}"

# Stop any leftover DI from earlier steps on the same runner job.
for f in /tmp/di-api-pr.pid /tmp/di-pr.pid /tmp/arq-worker-pr.pid /tmp/outbox-pr.pid; do
  if [[ -f "$f" ]]; then kill "$(cat "$f")" 2>/dev/null || true; fi
done

(
  cd services/document-intelligence
  nohup uvicorn document_intelligence.main:app --host 127.0.0.1 --port 8000 \
    >/tmp/di-api-pr.log 2>&1 &
  echo $! >/tmp/di-api-pr.pid
  nohup arq document_intelligence.workers.WorkerSettings \
    >/tmp/arq-worker-pr.log 2>&1 &
  echo $! >/tmp/arq-worker-pr.pid
  ln -sfn /tmp/arq-worker-pr.pid /tmp/arq-worker.pid
  ln -sfn /tmp/arq-worker-pr.log /tmp/arq-worker.log
  nohup python -m document_intelligence.outbox.dispatcher \
    >/tmp/outbox-pr.log 2>&1 &
  echo $! >/tmp/outbox-pr.pid
  ln -sfn /tmp/outbox-pr.pid /tmp/outbox.pid
  ln -sfn /tmp/outbox-pr.log /tmp/outbox.log
  ln -sfn /tmp/outbox-pr.log /tmp/outbox-dispatcher.log
  sleep 2
)

# Leave processes running for subsequent web-container checks unless requested.
if [[ "${CLEANUP_ON_EXIT:-false}" == "true" ]]; then
  cleanup() {
    for f in /tmp/di-api-pr.pid /tmp/arq-worker-pr.pid /tmp/outbox-pr.pid; do
      if [[ -f "$f" ]]; then kill "$(cat "$f")" 2>/dev/null || true; fi
    done
  }
  trap cleanup EXIT
fi

chmod +x scripts/ci/wait-for-live-services.sh \
  scripts/ci/check-arq-worker-ready.sh \
  scripts/ci/check-outbox-dispatcher-ready.sh

(
  cd services/document-intelligence
  bash "${ROOT_DIR}/scripts/ci/wait-for-live-services.sh" | tee "${OUT_DIR}/wait-for-live-services.txt"
  bash "${ROOT_DIR}/scripts/ci/check-arq-worker-ready.sh" | tee "${OUT_DIR}/arq-worker-ready.txt"
  bash "${ROOT_DIR}/scripts/ci/check-outbox-dispatcher-ready.sh" | tee "${OUT_DIR}/outbox-dispatcher-ready.txt"
)

# Migration status
set +e
pnpm --filter @contractradar/web exec prisma migrate status > "${OUT_DIR}/migration-status.txt" 2>&1
MIGRATE_STATUS=$?
set -e

# Web readiness (process-level when already built/running is optional; probe HTTP if up)
WEB_READY="skipped_not_running"
if curl -sf --max-time 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  if curl -sf --max-time 5 http://127.0.0.1:3000/api/health/ready >/dev/null 2>&1; then
    WEB_READY="ok"
  else
    WEB_READY="health_ok_ready_fail"
  fi
fi

# Connector/delivery workers: readiness is config-level in this slice (fake providers in CI).
CONNECTOR_READY="ok_config_none_or_fake"
DELIVERY_READY="ok_config_none_or_fake"

python3 - <<PY
import json, os, pathlib, socket, subprocess
out = pathlib.Path("${OUT_DIR}")
checks = {
  "postgres": False,
  "redis": False,
  "minio": False,
  "clamav": False,
  "documentIntelligence": False,
  "arqWorker": False,
  "outboxDispatcher": False,
  "migrationStatus": int("${MIGRATE_STATUS}") == 0,
  "webReadiness": "${WEB_READY}",
  "connectorWorker": "${CONNECTOR_READY}",
  "deliveryWorker": "${DELIVERY_READY}",
}
try:
    subprocess.check_call(
        ["pg_isready", "-h", "localhost", "-p", "5432", "-U", "contractradar"],
        stdout=subprocess.DEVNULL,
    )
    checks["postgres"] = True
except Exception:
    pass
try:
    s = socket.create_connection(("127.0.0.1", 6379), 1); s.close(); checks["redis"] = True
except Exception:
    pass
try:
    import urllib.request
    urllib.request.urlopen("${S3_ENDPOINT}/minio/health/live", timeout=3)
    checks["minio"] = True
except Exception:
    pass
try:
    r = subprocess.run(
        ["docker", "exec", "contractradar-ci-clamav", "clamdscan", "--ping", "3"],
        capture_output=True, text=True, timeout=20,
    )
    checks["clamav"] = r.returncode == 0
except Exception:
    pass
try:
    import urllib.request
    urllib.request.urlopen("${DOCUMENT_INTELLIGENCE_URL}/health/live", timeout=3)
    checks["documentIntelligence"] = True
except Exception:
    pass
arq_txt = (out / "arq-worker-ready.txt").read_text() if (out / "arq-worker-ready.txt").exists() else ""
outbox_txt = (out / "outbox-dispatcher-ready.txt").read_text() if (out / "outbox-dispatcher-ready.txt").exists() else ""
checks["arqWorker"] = "OK" in arq_txt or "ready" in arq_txt.lower()
checks["outboxDispatcher"] = "OK" in outbox_txt or "ready" in outbox_txt.lower()

required = ["postgres", "redis", "minio", "clamav", "documentIntelligence", "arqWorker", "outboxDispatcher", "migrationStatus"]
ok = all(checks[k] is True for k in required)
doc = {
  "status": "PASS" if ok else "FAIL",
  "ok": ok,
  "mode": "internal_synthetic_service_readiness",
  "checks": checks,
  "notes": (
    "Reused Live ingestion sidecars + wait/check scripts. "
    "Not a cloud deployment; no live customer provider; no real external data."
  ),
}
(out / "full-service-readiness-report.json").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
raise SystemExit(0 if ok else 1)
PY
