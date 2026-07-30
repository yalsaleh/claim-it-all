#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${SUPPLY_CHAIN_OUT_DIR:-${ROOT_DIR}/artifacts/supply-chain}"
mkdir -p "${OUT_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT_DIR}/sbom-${STAMP}.json"
LATEST="${OUT_DIR}/sbom.json"

python3 - <<PY > "${OUT}"
import json, hashlib, pathlib, datetime
root = pathlib.Path("${ROOT_DIR}")
lock = (root / "pnpm-lock.yaml").read_bytes()
pyproject = (root / "services/document-intelligence/pyproject.toml").read_bytes()
doc = {
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "version": 1,
  "metadata": {
    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00","Z"),
    "component": {"name": "contractradar", "version": "0.1.0", "type": "application"},
    "notes": "Offline lockfile SBOM evidence for CI; pair with license-inventory.json for licenses.",
  },
  "components": [
    {"type": "file", "name": "pnpm-lock.yaml", "hashes": [{"alg": "SHA-256", "content": hashlib.sha256(lock).hexdigest()}]},
    {"type": "file", "name": "services/document-intelligence/pyproject.toml", "hashes": [{"alg": "SHA-256", "content": hashlib.sha256(pyproject).hexdigest()}]},
  ],
}
print(json.dumps(doc, indent=2))
PY
cp "${OUT}" "${LATEST}"
echo "SBOM written: ${OUT}"
echo "${OUT}"
