#!/usr/bin/env bash
# Mode A — lightweight local verification (no Docker required).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# Match .github/workflows/ci.yml job env so unit tests see the same variables
# (notably INTEGRATION_DATABASE_URL / REQUIRE_INTEGRATION_DB).
export NODE_ENV="${NODE_ENV:-test}"
export APP_ENV="${APP_ENV:-test}"
export MALWARE_SCANNER="${MALWARE_SCANNER:-fake_test}"
export ALLOW_DEV_DEFAULTS="${ALLOW_DEV_DEFAULTS:-true}"
export APP_URL="${APP_URL:-http://localhost:3000}"
export DATABASE_URL="${DATABASE_URL:-postgresql://contractradar_app:contractradar@127.0.0.1:5432/contractradar_test?schema=public}"
export INTEGRATION_DATABASE_URL="${INTEGRATION_DATABASE_URL:-postgresql://contractradar_app:contractradar@127.0.0.1:5432/contractradar_test?schema=public}"
export DATABASE_MIGRATE_URL="${DATABASE_MIGRATE_URL:-postgresql://contractradar:contractradar@127.0.0.1:5432/contractradar_test?schema=public}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-test-secret-with-sufficient-length-32}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:3000}"
export DOCUMENT_INTELLIGENCE_URL="${DOCUMENT_INTELLIGENCE_URL:-http://localhost:8000}"
export DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN:-ci-internal-token-32chars}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}"
export S3_REGION="${S3_REGION:-us-east-1}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-minioadmin}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-minioadmin}"
export S3_BUCKET="${S3_BUCKET:-contractradar-documents}"
export S3_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-true}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export REQUIRE_INTEGRATION_DB="${REQUIRE_INTEGRATION_DB:-true}"
# Never treat local Mode A as live-ingestion verification.
export LIVE_INGESTION_TESTS=false
export REQUIRE_LIVE_INGESTION_TESTS=false

run() {
  echo ""
  echo "==> $*"
  "$@"
}

PNPM=(npx pnpm@9.15.0)

run "${PNPM[@]}" install --frozen-lockfile
run "${PNPM[@]}" validate:prisma
run "${PNPM[@]}" db:generate
run "${PNPM[@]}" format:check
run "${PNPM[@]}" --filter @contractradar/shared lint
run "${PNPM[@]}" --filter @contractradar/authz lint
run "${PNPM[@]}" --filter @contractradar/web lint
run "${PNPM[@]}" --filter @contractradar/shared typecheck
run "${PNPM[@]}" --filter @contractradar/authz typecheck
run "${PNPM[@]}" --filter @contractradar/contract-rules typecheck
run "${PNPM[@]}" --filter @contractradar/event-detection typecheck
run "${PNPM[@]}" --filter @contractradar/notice-drafting typecheck
run "${PNPM[@]}" --filter @contractradar/notice-delivery typecheck
run "${PNPM[@]}" --filter @contractradar/connectors typecheck
run "${PNPM[@]}" --filter @contractradar/operations typecheck
run "${PNPM[@]}" --filter @contractradar/platform typecheck
run "${PNPM[@]}" --filter @contractradar/web typecheck
run "${PNPM[@]}" test:unit
run "${PNPM[@]}" --filter @contractradar/platform build
run env CONTRACTRADAR_ENV=TEST ALLOW_DEV_DEFAULTS=true MALWARE_SCANNER=fake_test \
  CONNECTOR_PROVIDER=fake NOTICE_DELIVERY_PROVIDER=fake \
  "${PNPM[@]}" --filter @contractradar/web exec tsx scripts/production-validate.ts
run bash scripts/supply-chain/secret-scan.sh
run bash scripts/supply-chain/sbom.sh
run env SUPPLY_CHAIN_OUT_DIR="${ROOT_DIR}/artifacts/supply-chain" "${PNPM[@]}" security:audit
run "${PNPM[@]}" env:doctor
# Match CI: fail if any non-live integration suite reports skips.
set +e
INTEGRATION_OUTPUT="$("${PNPM[@]}" test:integration:embedded 2>&1 | tee /tmp/verify-local-integration.out)"
INTEGRATION_STATUS=${PIPESTATUS[0]}
set -e
echo "${INTEGRATION_OUTPUT}" | grep -E 'Test Files|Tests ' || true
if echo "${INTEGRATION_OUTPUT}" | grep -E '[1-9][0-9]* skipped'; then
  echo "Security integration tests must not skip."
  exit 1
fi
if [[ "${INTEGRATION_STATUS}" -ne 0 ]]; then
  exit "${INTEGRATION_STATUS}"
fi

# Python checks must match GitHub CI: ruff + mypy + pytest -k "not live"
# with APP_ENV/MALWARE_SCANNER/token/ALLOW_DEV_DEFAULTS (see .github/workflows/ci.yml).
# Prefer Python 3.12 (CI version) when available so mypy/deps match Actions.
(
  cd services/document-intelligence
  DI_PYTHON="python3"
  if command -v python3.12 >/dev/null 2>&1; then
    DI_PYTHON="python3.12"
  fi
  if [[ ! -x .venv-ci/bin/python ]] || ! .venv-ci/bin/python -c 'import sys; raise SystemExit(0 if sys.version_info[:2]==(3,12) else 1)' 2>/dev/null; then
    echo "==> Recreating services/document-intelligence/.venv-ci with ${DI_PYTHON} (CI parity)"
    rm -rf .venv-ci
    "${DI_PYTHON}" -m venv .venv-ci
    .venv-ci/bin/python -m pip install --upgrade pip
    .venv-ci/bin/pip install --only-binary=:all: -e ".[dev]" || .venv-ci/bin/pip install -e ".[dev]"
  fi
  run .venv-ci/bin/ruff check src tests
  run .venv-ci/bin/mypy src
  run env APP_ENV=test MALWARE_SCANNER=fake_test \
    DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN=ci-internal-token-32chars \
    ALLOW_DEV_DEFAULTS=true \
    .venv-ci/bin/pytest -q -k "not live"
)

run "${PNPM[@]}" build

echo ""
echo "============================================================"
echo "Mode A local verification completed."
echo "Live MinIO, Redis, ClamAV and ARQ integration were not executed."
echo "Run the GitHub Actions live-ingestion workflow for operational verification."
echo "============================================================"
