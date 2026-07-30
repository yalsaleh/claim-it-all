#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
# Lightweight secret pattern scan of tracked files (no external service).
set +e
HITS=$(git grep -I -nE '(AWS_SECRET_ACCESS_KEY|BEGIN RSA PRIVATE KEY|xox[baprs]-|ghp_[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]+)' -- \
  ':!.supply-chain-artifacts/*' ':!.backup-artifacts/*' ':!pnpm-lock.yaml' ':!**/node_modules/**' 2>/dev/null)
STATUS=$?
set -e
if [[ -n "${HITS}" ]]; then
  echo "Potential secrets found:"
  echo "${HITS}"
  exit 1
fi
echo "SECRET_SCAN_OK"
exit 0
