#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"
# Lightweight secret pattern scan of tracked files (no external service).
# Exclude this script so the pattern literals are not treated as findings.
set +e
HITS=$(git grep -I -nE '(AWS_SECRET_ACCESS_KEY[[:space:]]*=[[:space:]]*['\''\"]?[A-Za-z0-9/+]{20,}|BEGIN RSA PRIVATE KEY|xox[baprs]-[A-Za-z0-9-]{10,}|ghp_[A-Za-z0-9]{36}|sk_live_[A-Za-z0-9]{20,})' -- \
  ':!.supply-chain-artifacts/*' \
  ':!.backup-artifacts/*' \
  ':!pnpm-lock.yaml' \
  ':!**/node_modules/**' \
  ':!scripts/supply-chain/secret-scan.sh' \
  ':!docs/**' \
  ':!**/*.md' \
  2>/dev/null)
STATUS=$?
set -e
# git grep exits 1 when there are no matches.
if [[ -n "${HITS}" ]]; then
  echo "Potential secrets found:"
  echo "${HITS}"
  exit 1
fi
echo "SECRET_SCAN_OK (git-grep-status=${STATUS})"
exit 0
