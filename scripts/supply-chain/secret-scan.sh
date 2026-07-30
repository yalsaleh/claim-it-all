#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${SUPPLY_CHAIN_OUT_DIR:-${ROOT_DIR}/artifacts/supply-chain}"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"
REPORT="${OUT_DIR}/secret-scan.txt"
set +e
HITS=$(git grep -I -nE '(AWS_SECRET_ACCESS_KEY[[:space:]]*=[[:space:]]*['\''\"]?[A-Za-z0-9/+]{20,}|BEGIN RSA PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{36}|sk_live_[A-Za-z0-9]{20,})' -- \
  ':!.supply-chain-artifacts/*' \
  ':!artifacts/**' \
  ':!.backup-artifacts/*' \
  ':!pnpm-lock.yaml' \
  ':!**/node_modules/**' \
  ':!scripts/supply-chain/secret-scan.sh' \
  ':!docs/**' \
  ':!**/*.md' \
  2>/dev/null)
STATUS=$?
set -e
if [[ -n "${HITS}" ]]; then
  echo "Potential secrets found:" | tee "${REPORT}"
  echo "${HITS}" | tee -a "${REPORT}"
  exit 1
fi
echo "SECRET_SCAN_OK (git-grep-status=${STATUS})" | tee "${REPORT}"
exit 0
