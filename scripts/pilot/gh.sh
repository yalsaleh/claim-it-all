#!/usr/bin/env bash
# Prefer system `gh`, then repository-local `.tools/gh`.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if command -v gh >/dev/null 2>&1; then
  exec gh "$@"
fi

if [[ -x "${ROOT_DIR}/.tools/gh" ]]; then
  exec "${ROOT_DIR}/.tools/gh" "$@"
fi

if [[ -x "${ROOT_DIR}/.tools/gh/bin/gh" ]]; then
  exec "${ROOT_DIR}/.tools/gh/bin/gh" "$@"
fi

echo "gh CLI not found. Install GitHub CLI or place a binary at .tools/gh" >&2
exit 127
