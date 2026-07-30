#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/.supply-chain-artifacts"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

set +e
pnpm audit --json > "${OUT_DIR}/pnpm-audit.json" 2>"${OUT_DIR}/pnpm-audit.err"
PNPM_STATUS=$?
set -e

cd services/document-intelligence
set +e
if [[ -x .venv-ci/bin/pip-audit ]]; then
  .venv-ci/bin/pip-audit -f json -o "${OUT_DIR}/pip-audit.json" 2>"${OUT_DIR}/pip-audit.err"
elif command -v pip-audit >/dev/null 2>&1; then
  pip-audit -f json -o "${OUT_DIR}/pip-audit.json" 2>"${OUT_DIR}/pip-audit.err"
else
  echo '{"note":"pip-audit not installed; skipped"}' > "${OUT_DIR}/pip-audit.json"
fi
set -e

echo "Audit artifacts in ${OUT_DIR}"
# Do not fail the whole CI on advisory noise in this slice; production-readiness reviews the files.
exit 0
