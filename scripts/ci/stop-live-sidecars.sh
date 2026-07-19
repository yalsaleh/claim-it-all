#!/usr/bin/env bash
# Always succeeds so workflow `if: always()` cleanup never masks the job failure.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/sidecar-helpers.sh"

stop_live_sidecars
exit 0
