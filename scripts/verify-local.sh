#!/usr/bin/env bash
# Mode A — lightweight local verification (no Docker required).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

export NODE_ENV="${NODE_ENV:-test}"
export APP_ENV="${APP_ENV:-test}"
export MALWARE_SCANNER="${MALWARE_SCANNER:-fake_test}"
export ALLOW_DEV_DEFAULTS="${ALLOW_DEV_DEFAULTS:-true}"
export APP_URL="${APP_URL:-http://localhost:3000}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-test-secret-with-sufficient-length-32}"
export DOCUMENT_INTELLIGENCE_URL="${DOCUMENT_INTELLIGENCE_URL:-http://localhost:8000}"
export DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN:-dev-internal-token-change-me}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}"
export S3_REGION="${S3_REGION:-us-east-1}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-minioadmin}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-minioadmin}"
export S3_BUCKET="${S3_BUCKET:-contractradar-documents}"
export S3_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-true}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
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
run "${PNPM[@]}" --filter @contractradar/web typecheck
run "${PNPM[@]}" test:unit
run "${PNPM[@]}" test:integration:embedded

if [[ -x services/document-intelligence/.venv/bin/ruff ]]; then
  (
    cd services/document-intelligence
    run .venv/bin/ruff check src tests
    run .venv/bin/mypy src
    run env APP_ENV=test MALWARE_SCANNER=fake_test \
      DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN=test-internal-token-32chars \
      ALLOW_DEV_DEFAULTS=true \
      .venv/bin/pytest -q -k "not live"
  )
else
  (
    cd services/document-intelligence
    run python3 -m pip install -e ".[dev]"
    run ruff check src tests
    run mypy src
    run env APP_ENV=test MALWARE_SCANNER=fake_test \
      DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN=test-internal-token-32chars \
      ALLOW_DEV_DEFAULTS=true \
      pytest -q -k "not live"
  )
fi

run "${PNPM[@]}" build

echo ""
echo "============================================================"
echo "Mode A local verification completed."
echo "Live MinIO, Redis, ClamAV and ARQ integration were not executed."
echo "Run the GitHub Actions live-ingestion workflow for operational verification."
echo "============================================================"
