#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${ROOT_DIR}/.supply-chain-artifacts"
mkdir -p "${OUT_DIR}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT_DIR}/sbom-${STAMP}.json"

# Minimal SBOM from lockfile + Python requirements without external SaaS.
python3 - <<PY > "${OUT}"
import json, hashlib, pathlib
root = pathlib.Path("${ROOT_DIR}")
lock = (root / "pnpm-lock.yaml").read_bytes()
pyproject = (root / "services/document-intelligence/pyproject.toml").read_bytes()
doc = {
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "version": 1,
  "metadata": {
    "timestamp": "${STAMP}",
    "component": {"name": "contractradar", "version": "0.1.0", "type": "application"},
    "notes": "Generated offline from lockfiles for CI evidence; not a full transitive license graph.",
  },
  "components": [
    {"type": "file", "name": "pnpm-lock.yaml", "hashes": [{"alg": "SHA-256", "content": hashlib.sha256(lock).hexdigest()}]},
    {"type": "file", "name": "services/document-intelligence/pyproject.toml", "hashes": [{"alg": "SHA-256", "content": hashlib.sha256(pyproject).hexdigest()}]},
  ],
}
print(json.dumps(doc, indent=2))
PY
echo "SBOM written: ${OUT}"
echo "${OUT}"
