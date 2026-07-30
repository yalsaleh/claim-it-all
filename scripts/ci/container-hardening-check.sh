#!/usr/bin/env bash
# Verify container hardening: DI image runs non-root; web Dockerfile declares non-root USER.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${PROD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/production-readiness}"
mkdir -p "${OUT_DIR}"
REPORT="${OUT_DIR}/container-hardening.json"

WEB_DOCKERFILE="${ROOT_DIR}/apps/web/Dockerfile"
DI_DOCKERFILE="${ROOT_DIR}/services/document-intelligence/Dockerfile"
grep -qE '^USER 10001' "${WEB_DOCKERFILE}"
grep -qE '^USER 10001' "${DI_DOCKERFILE}"
grep -qE 'HEALTHCHECK' "${WEB_DOCKERFILE}"
grep -qE 'HEALTHCHECK' "${DI_DOCKERFILE}"
! grep -qE '\.env' "${WEB_DOCKERFILE}"
! grep -qE '\.env' "${DI_DOCKERFILE}"

if ! command -v docker >/dev/null 2>&1; then
  if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "Docker required in CI for DI image non-root verification"; exit 1
  fi
  python3 - <<PY
import json, pathlib
pathlib.Path("${REPORT}").write_text(json.dumps({
  "ok": True,
  "status": "PARTIAL — Docker unavailable locally; Dockerfiles assert USER 10001",
  "webDockerfileUser": "10001",
  "diDockerfileUser": "10001",
  "diImageBuilt": False,
}, indent=2)+"\n")
print(open("${REPORT}").read())
PY
  exit 0
fi

IMG_DI="contractradar-di-hardening:local"
docker build -t "${IMG_DI}" -f "${DI_DOCKERFILE}" "${ROOT_DIR}/services/document-intelligence"
UID_DI="$(docker inspect --format '{{.Config.User}}' "${IMG_DI}")"

python3 - <<PY
import json, pathlib
di = "${UID_DI}".strip()
ok = di not in {"", "0", "0:0", "root"} and not di.startswith("0:")
doc = {
  "ok": ok,
  "diUser": di,
  "webDockerfileUser": "10001",
  "diDockerfileUser": "10001",
  "diImageBuilt": True,
  "webImageBuilt": False,
  "notes": "Web non-root asserted via Dockerfile USER; DI image built and inspected. Not a cloud deploy.",
}
pathlib.Path("${REPORT}").write_text(json.dumps(doc, indent=2) + "\n")
print(json.dumps(doc, indent=2))
raise SystemExit(0 if ok else 1)
PY
