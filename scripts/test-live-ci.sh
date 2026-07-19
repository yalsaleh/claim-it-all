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

echo "==> Web live suite"
set +e
npx pnpm@9.15.0 --filter @contractradar/web test:live >"${WEB_OUT}" 2>&1
WEB_RC=$?
set -e
# Print sanitized summary lines only (avoid dumping signed URLs if any)
grep -E '✓|×|↓|Test Files|Tests |FAIL|Error:|passed|failed|skipped' "${WEB_OUT}" || true

echo "==> Python live suite"
set +e
(
  cd services/document-intelligence
  pytest -q -k live --junitxml="${ROOT_DIR}/artifacts/live-python-junit.xml"
) >"${PY_OUT}" 2>&1
PY_RC=$?
set -e
grep -E 'PASSED|FAILED|SKIPPED|passed|failed|skipped|error|=' "${PY_OUT}" || true

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

if [[ "${WEB_RC}" -ne 0 || "${PY_RC}" -ne 0 ]]; then
  echo "Live ingestion tests FAILED (web=${WEB_RC} python=${PY_RC})"
  exit 1
fi

echo "Live ingestion tests PASSED (no unexpected skips)"
echo "{\"status\":\"passed\",\"web_rc\":0,\"python_rc\":0}" >artifacts/live-summary.json
