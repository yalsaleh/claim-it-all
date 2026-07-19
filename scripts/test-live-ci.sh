#!/usr/bin/env bash
# Mode B — authoritative live ingestion tests (CI / real data plane only).
# Fails on unexpected skips when REQUIRE_LIVE_INGESTION_TESTS=true.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"
mkdir -p artifacts

export LIVE_INGESTION_TESTS="${LIVE_INGESTION_TESTS:-true}"
export REQUIRE_LIVE_INGESTION_TESTS="${REQUIRE_LIVE_INGESTION_TESTS:-true}"
export LIVE_ARQ_WORKER="${LIVE_ARQ_WORKER:-true}"
export MALWARE_SCANNER="${MALWARE_SCANNER:-clamav}"
export APP_ENV="${APP_ENV:-test}"
export NODE_ENV="${NODE_ENV:-test}"

if [[ "${MALWARE_SCANNER}" == "fake_test" ]]; then
  echo "ERROR: test:live:ci refuses MALWARE_SCANNER=fake_test"
  exit 1
fi

WEB_OUT="artifacts/live-web.log"
PY_OUT="artifacts/live-python.log"
: >"${WEB_OUT}"
: >"${PY_OUT}"

sanitize_log() {
  # Strip signed URL / credential material from streamed diagnostics.
  sed -E \
    -e 's/X-Amz-[A-Za-z0-9_-]+=[^&\s"]+/X-Amz-REDACTED=REDACTED/g' \
    -e 's#(password|secret|token|authorization)=[^[:space:]]+#\1=REDACTED#gi' \
    -e 's#postgresql://[^@[:space:]]+@#postgresql://***@#g'
}

dump_sidecar_diagnostics() {
  echo ""
  echo "==== Live process status ===="
  for label_pid in "arq-worker:/tmp/arq-worker.pid" "outbox-dispatcher:/tmp/outbox.pid" "document-intelligence:/tmp/di-api.pid"; do
    label="${label_pid%%:*}"
    pidfile="${label_pid##*:}"
    if [[ -f "${pidfile}" ]]; then
      pid="$(cat "${pidfile}")"
      if kill -0 "${pid}" 2>/dev/null; then
        echo "${label}: pid=${pid} alive"
      else
        echo "${label}: pid=${pid} DEAD"
      fi
    else
      echo "${label}: pid file missing (${pidfile})"
    fi
  done

  echo ""
  echo "==== ARQ worker log (tail) ===="
  if [[ -f /tmp/arq-worker.log ]]; then
    tail -n 150 /tmp/arq-worker.log | sanitize_log || true
  else
    echo "(missing /tmp/arq-worker.log)"
  fi

  echo ""
  echo "==== Outbox dispatcher log (tail) ===="
  # Startup writes /tmp/outbox.log; accept alias name too.
  if [[ -f /tmp/outbox.log ]]; then
    tail -n 150 /tmp/outbox.log | sanitize_log || true
  elif [[ -f /tmp/outbox-dispatcher.log ]]; then
    tail -n 150 /tmp/outbox-dispatcher.log | sanitize_log || true
  else
    echo "(missing /tmp/outbox.log)"
  fi

  echo ""
  echo "==== Document-intelligence API log (tail) ===="
  # Startup writes /tmp/di-api.log; workflow also symlinks document-intelligence.log.
  if [[ -f /tmp/di-api.log ]]; then
    tail -n 150 /tmp/di-api.log | sanitize_log || true
  elif [[ -f /tmp/document-intelligence.log ]]; then
    tail -n 150 /tmp/document-intelligence.log | sanitize_log || true
  else
    echo "(missing /tmp/di-api.log)"
  fi
}

echo "==> Web live suite"
set +e
# Keep a full log artifact, but also stream to CI so failures are visible.
npx pnpm@9.15.0 --filter @contractradar/web test:live 2>&1 | tee "${WEB_OUT}" | sanitize_log
WEB_RC=${PIPESTATUS[0]}
set -e

echo ""
echo "==> Web live failure excerpts"
# Always surface diagnostics + assertion/timeout detail (not only ✓/× summary lines).
grep -E \
  '✓|×|↓|FAIL|Error:|AssertionError|Timed out|live-ingestion|live-stage|Test Files|Tests |passed|failed|skipped|LiveTestStageError|expected|received' \
  "${WEB_OUT}" | sanitize_log | tail -n 200 || true

echo "==> Python live suite"
set +e
(
  cd services/document-intelligence
  pytest -q -k live --junitxml="${ROOT_DIR}/artifacts/live-python-junit.xml"
) 2>&1 | tee "${PY_OUT}" | sanitize_log
PY_RC=${PIPESTATUS[0]}
set -e

grep -E 'PASSED|FAILED|SKIPPED|passed|failed|skipped|error|AssertionError|arq_live_diagnostics|=' "${PY_OUT}" | sanitize_log | tail -n 80 || true

fail_on_skips() {
  local file="$1"
  local label="$2"
  if [[ "${REQUIRE_LIVE_INGESTION_TESTS}" == "true" || "${REQUIRE_LIVE_INGESTION_TESTS}" == "1" ]]; then
    if grep -Eiq '[1-9][0-9]* skipped|SKIPPED' "${file}"; then
      echo "ERROR: unexpected skips in ${label} while REQUIRE_LIVE_INGESTION_TESTS=true"
      return 1
    fi
  fi
  return 0
}

echo ""
echo "==== Live ingestion summary ===="
WEB_LINE="$(grep -E 'Tests |passed|failed|skipped' "${WEB_OUT}" | tail -3 | tr '\n' '; ')"
PY_LINE="$(grep -E 'passed|failed|skipped|deselected' "${PY_OUT}" | tail -2 | tr '\n' '; ')"
echo "web-live: ${WEB_LINE:-see artifacts/live-web.log}"
echo "python-live: ${PY_LINE:-see artifacts/live-python.log}"

fail_on_skips "${WEB_OUT}" "web-live" || WEB_RC=1
fail_on_skips "${PY_OUT}" "python-live" || PY_RC=1

if grep -Eiq 'X-Amz-Signature=|X-Amz-Credential=' "${WEB_OUT}" "${PY_OUT}"; then
  echo "ERROR: signed URL material detected in live test output"
  exit 1
fi

if [[ "${WEB_RC}" -ne 0 ]]; then
  dump_sidecar_diagnostics
fi

if [[ "${WEB_RC}" -ne 0 || "${PY_RC}" -ne 0 ]]; then
  echo "Live ingestion tests FAILED (web=${WEB_RC} python=${PY_RC})"
  exit 1
fi

echo "Live ingestion tests PASSED (no unexpected skips)"
echo "{\"status\":\"passed\",\"web_rc\":0,\"python_rc\":0}" >artifacts/live-summary.json
