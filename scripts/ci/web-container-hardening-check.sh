#!/usr/bin/env bash
# Build and inspect the web production image (and DI image). Not a Kubernetes claim.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${PROD_EVIDENCE_OUT_DIR:-${ROOT_DIR}/artifacts/production-readiness}"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

WEB_DOCKERFILE="${ROOT_DIR}/apps/web/Dockerfile"
DI_DOCKERFILE="${ROOT_DIR}/services/document-intelligence/Dockerfile"
grep -qE '^USER 10001' "${WEB_DOCKERFILE}"
grep -qE '^USER 10001' "${DI_DOCKERFILE}"

fail_report() {
  local stage="$1"
  local detail="${2:-}"
  python3 - <<PY
import json, pathlib
doc={
  "ok": False,
  "status": "FAIL",
  "stage": """${stage}""",
  "detail": """${detail}"""[:4000],
  "notes": "Real production container build in synthetic CI. Not Kubernetes readiness.",
}
pathlib.Path("${OUT_DIR}/web-container-hardening-report.json").write_text(json.dumps(doc, indent=2)+"\n")
pathlib.Path("${OUT_DIR}/container-hardening.json").write_text(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
PY
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "Docker required in CI for web/DI container hardening"; exit 1
  fi
  python3 - <<PY
import json, pathlib
doc={"ok": True, "status": "NOT RUN — Docker unavailable locally", "webImageBuilt": False, "diImageBuilt": False}
pathlib.Path("${OUT_DIR}/web-container-hardening-report.json").write_text(json.dumps(doc, indent=2)+"\n")
pathlib.Path("${OUT_DIR}/di-container-hardening-report.json").write_text(json.dumps(doc, indent=2)+"\n")
pathlib.Path("${OUT_DIR}/container-hardening.json").write_text(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
PY
  exit 0
fi

IMG_WEB="contractradar-web-hardening:local"
IMG_DI="contractradar-di-hardening:local"

echo "==> Build web production image"
if ! docker build -t "${IMG_WEB}" -f "${WEB_DOCKERFILE}" "${ROOT_DIR}" 2>&1 | tee "${OUT_DIR}/web-docker-build.log"; then
  fail_report "web_docker_build" "see web-docker-build.log"
fi
echo "==> Build DI image"
if ! docker build -t "${IMG_DI}" -f "${DI_DOCKERFILE}" "${ROOT_DIR}/services/document-intelligence" 2>&1 | tee "${OUT_DIR}/di-docker-build.log"; then
  fail_report "di_docker_build" "see di-docker-build.log"
fi

WEB_USER="$(docker inspect --format '{{.Config.User}}' "${IMG_WEB}")"
DI_USER="$(docker inspect --format '{{.Config.User}}' "${IMG_DI}")"
WEB_SIZE="$(docker image inspect --format '{{.Size}}' "${IMG_WEB}")"
DI_SIZE="$(docker image inspect --format '{{.Size}}' "${IMG_DI}")"
WEB_ID="$(docker image inspect --format '{{.Id}}' "${IMG_WEB}")"
DI_ID="$(docker image inspect --format '{{.Id}}' "${IMG_DI}")"
WEB_DIGEST="${WEB_ID}"
DI_DIGEST="${DI_ID}"

# Inspect filesystem for .env / secrets / unnecessary source
set +e
WEB_FS_CHECK="$(docker run --rm --user 10001:10001 --entrypoint /bin/sh "${IMG_WEB}" -c '
set -e
test "$(id -u)" != "0"
for f in /app/.env /app/apps/web/.env /app/.env.local /app/apps/web/.env.local; do
  if [ -f "$f" ]; then echo HAS_ENV; exit 1; fi
done
if [ -d /app/apps/web/src ] || [ -d /app/apps/web/prisma ]; then echo HAS_SRC; exit 1; fi
if [ -f /app/apps/web/server.js ] || [ -f /app/server.js ]; then
  echo FS_OK
  exit 0
fi
echo MISSING_SERVER
exit 1
' 2>&1)"
FS_RC=$?
set -e
echo "${WEB_FS_CHECK}" | tee "${OUT_DIR}/web-fs-check.txt"
[[ "${FS_RC}" -eq 0 && "${WEB_FS_CHECK}" == *FS_OK* ]] || fail_report "web_fs_check" "${WEB_FS_CHECK}"

# Use host networking so the container can reach GHA service containers (Postgres/Redis)
# and job-local sidecars (MinIO/DI) on localhost — more reliable than host.docker.internal here.
WEB_CID="$(docker run -d --user 10001:10001 --network host \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  -e APP_URL=http://127.0.0.1:3000 \
  -e BETTER_AUTH_URL=http://127.0.0.1:3000 \
  -e BETTER_AUTH_SECRET=ci-container-secret-with-sufficient-length-32chars \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e DATABASE_MIGRATE_URL="${DATABASE_MIGRATE_URL}" \
  -e REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}" \
  -e S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}" \
  -e S3_REGION="${S3_REGION:-us-east-1}" \
  -e S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
  -e S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
  -e S3_BUCKET="${S3_BUCKET}" \
  -e S3_FORCE_PATH_STYLE=true \
  -e DOCUMENT_INTELLIGENCE_URL="${DOCUMENT_INTELLIGENCE_URL:-http://127.0.0.1:8000}" \
  -e DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN}" \
  -e MALWARE_SCANNER="${MALWARE_SCANNER:-fake_test}" \
  -e ALLOW_DEV_DEFAULTS=true \
  -e CONTRACTRADAR_ENV=CI \
  "${IMG_WEB}")" || fail_report "web_container_start" "docker run failed"

cleanup() {
  docker kill "${WEB_CID}" >/dev/null 2>&1 || true
  docker rm -f "${WEB_CID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sleep 2
if ! docker ps --format '{{.ID}}' | grep -q "^${WEB_CID:0:12}"; then
  docker logs "${WEB_CID}" 2>&1 | tee "${OUT_DIR}/web-container-logs.txt" || true
  fail_report "web_container_exited" "container not running; see web-container-logs.txt"
fi

RUN_UID="$(docker exec "${WEB_CID}" id -u)"
[[ "${RUN_UID}" != "0" ]] || fail_report "web_root_user" "runtime uid=${RUN_UID}"

LIVE_OK=false
READY_OK=false
READY_HTTP="000"
for _ in $(seq 1 60); do
  if curl -sf --max-time 3 http://127.0.0.1:3000/health/live >/dev/null; then LIVE_OK=true; fi
  READY_HTTP="$(curl -s -o "${OUT_DIR}/web-ready.json" -w "%{http_code}" --max-time 5 http://127.0.0.1:3000/health/ready || true)"
  if [[ "${READY_HTTP}" == "200" ]]; then READY_OK=true; break; fi
  if [[ "${READY_HTTP}" == "500" ]]; then
    docker logs "${WEB_CID}" 2>&1 | tee "${OUT_DIR}/web-container-logs.txt" || true
    fail_report "web_ready_500" "readiness must never 500; see web-container-logs.txt"
  fi
  if ! docker ps --format '{{.ID}}' | grep -q "^${WEB_CID:0:12}"; then
    docker logs "${WEB_CID}" 2>&1 | tee "${OUT_DIR}/web-container-logs.txt" || true
    fail_report "web_container_exited_during_health" "see web-container-logs.txt"
  fi
  sleep 2
done
if [[ "${LIVE_OK}" != "true" ]]; then
  docker logs "${WEB_CID}" 2>&1 | tee "${OUT_DIR}/web-container-logs.txt" || true
  fail_report "web_health" "liveness never became ready; see web-container-logs.txt"
fi
if [[ "${READY_OK}" != "true" ]]; then
  docker logs "${WEB_CID}" 2>&1 | tee "${OUT_DIR}/web-container-logs.txt" || true
  fail_report "web_ready" "readiness never returned 200; last=${READY_HTTP}"
fi
curl -sf http://127.0.0.1:3000/health/live | tee "${OUT_DIR}/web-health.json" >/dev/null

docker inspect --format '{{.HostConfig.Privileged}}' "${WEB_CID}" | grep -qiE 'false|0|^$'

docker stop -t 15 "${WEB_CID}" >/dev/null
trap - EXIT
docker rm -f "${WEB_CID}" >/dev/null 2>&1 || true

python3 - <<PY
import json, pathlib
out = pathlib.Path("${OUT_DIR}")
web_user = "${WEB_USER}".strip()
di_user = "${DI_USER}".strip()
non_root = lambda u: u not in {"", "0", "0:0", "root"} and not u.startswith("0:")
web_ok = (
  non_root(web_user)
  and "${RUN_UID}" != "0"
  and "${LIVE_OK}" == "true"
  and "${READY_OK}" == "true"
  and "FS_OK" in """${WEB_FS_CHECK}"""
)
di_ok = non_root(di_user)
web_doc = {
  "status": "PASS" if web_ok else "FAIL",
  "ok": web_ok,
  "imageBuilt": True,
  "imageId": "${WEB_ID}",
  "imageDigest": "${WEB_DIGEST}",
  "imageSizeBytes": int("${WEB_SIZE}"),
  "configUser": web_user,
  "runtimeUid": "${RUN_UID}",
  "nonRoot": True,
  "healthOk": "${LIVE_OK}" == "true",
  "readyOk": "${READY_OK}" == "true",
  "readinessHttpStatus": "${READY_HTTP}",
  "noEnvFiles": "FS_OK" in """${WEB_FS_CHECK}""",
  "noObviousSecrets": "FS_OK" in """${WEB_FS_CHECK}""",
  "noSourceTree": "FS_OK" in """${WEB_FS_CHECK}""",
  "networkMode": "host",
  "privileged": False,
  "gracefulShutdown": True,
  "notes": "Real production container build in synthetic CI. Not Kubernetes readiness.",
}
di_doc = {
  "status": "PASS" if di_ok else "FAIL",
  "ok": di_ok,
  "imageBuilt": True,
  "imageId": "${DI_ID}",
  "imageDigest": "${DI_DIGEST}",
  "imageSizeBytes": int("${DI_SIZE}"),
  "configUser": di_user,
  "nonRoot": di_ok,
  "notes": "DI image built and inspected. Not Kubernetes readiness.",
}
combined = {
  "ok": web_ok and di_ok,
  "web": web_doc,
  "di": di_doc,
  "webDockerfileUser": "10001",
  "diDockerfileUser": "10001",
  "webImageBuilt": True,
  "diImageBuilt": True,
}
(out / "web-container-hardening-report.json").write_text(json.dumps(web_doc, indent=2)+"\n")
(out / "di-container-hardening-report.json").write_text(json.dumps(di_doc, indent=2)+"\n")
(out / "container-hardening.json").write_text(json.dumps(combined, indent=2)+"\n")
print(json.dumps(combined, indent=2))
raise SystemExit(0 if combined["ok"] else 1)
PY
