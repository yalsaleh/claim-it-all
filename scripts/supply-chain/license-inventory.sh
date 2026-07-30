#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export SUPPLY_CHAIN_OUT_DIR="${SUPPLY_CHAIN_OUT_DIR:-${ROOT_DIR}/artifacts/supply-chain}"
mkdir -p "${SUPPLY_CHAIN_OUT_DIR}"
node "${ROOT_DIR}/scripts/supply-chain/license-inventory.mjs"
