#!/usr/bin/env bash
# Synthetic CI health/readiness gates (not a cloud deploy claim).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${PROD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/production-readiness}"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

(
  cd services/document-intelligence
  if [[ ! -x .venv-ci-pr/bin/python ]]; then
    python3 -m venv .venv-ci-pr
    .venv-ci-pr/bin/pip install -q -e ".[dev]" || pip install -q -e ".[dev]"
  fi
  nohup .venv-ci-pr/bin/uvicorn document_intelligence.main:app --host 127.0.0.1 --port 8000 \
    > /tmp/di-pr.log 2>&1 &
  echo $! > /tmp/di-pr.pid
)

cleanup() { kill "$(cat /tmp/di-pr.pid 2>/dev/null)" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 45); do
  if curl -sf http://127.0.0.1:8000/health/live >/dev/null; then
    break
  fi
  sleep 1
done

curl -sf http://127.0.0.1:8000/health/live | tee "${OUT_DIR}/di-liveness.json"
set +e
curl -sf http://127.0.0.1:8000/health/ready | tee "${OUT_DIR}/di-readiness.json"
export DI_READY_HTTP_OK=$?
set -e
test -s "${OUT_DIR}/di-liveness.json"

python3 - <<PY
import json, os, pathlib, socket, subprocess
out = pathlib.Path("${OUT_DIR}")
checks = {"di_liveness": True, "postgres": False, "redis": False, "minio": False}
try:
    subprocess.check_call(
        ["pg_isready", "-h", "localhost", "-p", "5432", "-U", "contractradar"],
        stdout=subprocess.DEVNULL,
    )
    checks["postgres"] = True
except Exception:
    pass
try:
    s = socket.create_connection(("127.0.0.1", 6379), 1)
    s.close()
    checks["redis"] = True
except Exception:
    pass
try:
    s = socket.create_connection(("127.0.0.1", 9000), 1)
    s.close()
    checks["minio"] = True
except Exception:
    pass
ok = all(checks.values())
doc = {
    "ok": ok,
    "checks": checks,
    "diReadyHttpOk": int(os.environ.get("DI_READY_HTTP_OK", "1")) == 0,
    "notes": "Public surface remains minimal (/health/*). Synthetic CI stack only.",
}
(out / "health-readiness.json").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
raise SystemExit(0 if ok else 1)
PY
