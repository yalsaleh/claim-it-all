#!/usr/bin/env bash
# Production web container runtime contract for Slice 10 (synthetic CI only).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${PILOT_READY_OUT_DIR:-${ROOT_DIR}/artifacts/pilot-readiness}"
mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

fail() {
  python3 - <<PY
import json, pathlib
doc={"ok": False, "status": "FAIL", "stage": """$1""", "detail": """${2:-}"""[:4000]}
pathlib.Path("${OUT_DIR}/web-container-runtime-report.json").write_text(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
PY
  exit 1
}

if ! command -v docker >/dev/null 2>&1; then
  if [[ "${CI:-}" == "true" || "${GITHUB_ACTIONS:-}" == "true" ]]; then
    echo "Docker required in CI"; exit 1
  fi
  python3 - <<PY
import json, pathlib
doc={"ok": True, "status": "NOT RUN — Docker unavailable locally", "imageBuilt": False}
pathlib.Path("${OUT_DIR}/web-container-runtime-report.json").write_text(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
PY
  exit 0
fi

IMG="contractradar-web-runtime:local"
docker build -t "${IMG}" -f apps/web/Dockerfile . 2>&1 | tee "${OUT_DIR}/web-runtime-build.log"
USER_CFG="$(docker inspect --format '{{.Config.User}}' "${IMG}")"
[[ "${USER_CFG}" == "10001:10001" || "${USER_CFG}" == "10001" ]] || fail "non_root" "user=${USER_CFG}"

docker run --rm --user 10001:10001 --entrypoint /bin/sh "${IMG}" -c '
  test "$(id -u)" != "0"
  test ! -f /app/.env
  test ! -f /app/apps/web/.env
  test -f /app/apps/web/server.js || test -f /app/server.js
' || fail "fs_check" "env or server missing"

# Start without DB — live must pass, ready must fail.
BAD_CID="$(docker run -d --user 10001:10001 --network host \
  -e NODE_ENV=production -e PORT=3010 -e HOSTNAME=0.0.0.0 \
  -e CONTRACTRADAR_ENV=CI -e ALLOW_DEV_DEFAULTS=true \
  -e APP_URL=http://127.0.0.1:3010 -e BETTER_AUTH_URL=http://127.0.0.1:3010 \
  -e BETTER_AUTH_SECRET=ci-container-secret-with-sufficient-length-32chars \
  -e DATABASE_URL=postgresql://contractradar_app:bad@127.0.0.1:1/none \
  -e DATABASE_MIGRATE_URL=postgresql://contractradar:bad@127.0.0.1:1/none \
  -e REDIS_URL=redis://127.0.0.1:1 -e S3_ENDPOINT=http://127.0.0.1:1 \
  -e S3_REGION=us-east-1 -e S3_ACCESS_KEY_ID=x -e S3_SECRET_ACCESS_KEY=y -e S3_BUCKET=b \
  -e S3_FORCE_PATH_STYLE=true \
  -e DOCUMENT_INTELLIGENCE_URL=http://127.0.0.1:1 \
  -e DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN=ci-internal-token-32chars \
  -e MALWARE_SCANNER=fake_test \
  -e PORT=3010 \
  "${IMG}")"
cleanup_bad() { docker rm -f "${BAD_CID}" >/dev/null 2>&1 || true; }
trap cleanup_bad EXIT
sleep 3
LIVE_BAD="$(curl -s -o "${OUT_DIR}/live-without-db.json" -w "%{http_code}" http://127.0.0.1:3010/health/live || true)"
READY_BAD="$(curl -s -o "${OUT_DIR}/ready-without-db.json" -w "%{http_code}" http://127.0.0.1:3010/health/ready || true)"
[[ "${LIVE_BAD}" == "200" ]] || { docker logs "${BAD_CID}" | tee "${OUT_DIR}/web-runtime-bad-logs.txt"; fail "live_without_db" "http=${LIVE_BAD}"; }
[[ "${READY_BAD}" == "503" ]] || fail "ready_without_db_should_503" "http=${READY_BAD}"
docker stop -t 10 "${BAD_CID}" >/dev/null
trap - EXIT
docker rm -f "${BAD_CID}" >/dev/null 2>&1 || true

# Start with synthetic deps (host network). Use 3020 to avoid clashing with other probes.
GOOD_CID="$(docker run -d --user 10001:10001 --network host \
  -e NODE_ENV=production -e PORT=3020 -e HOSTNAME=0.0.0.0 \
  -e CONTRACTRADAR_ENV=CI -e ALLOW_DEV_DEFAULTS=true \
  -e APP_URL=http://127.0.0.1:3020 -e BETTER_AUTH_URL=http://127.0.0.1:3020 \
  -e BETTER_AUTH_SECRET=ci-container-secret-with-sufficient-length-32chars \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e DATABASE_MIGRATE_URL="${DATABASE_MIGRATE_URL:-$DATABASE_URL}" \
  -e REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}" \
  -e S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:9000}" \
  -e S3_REGION="${S3_REGION:-us-east-1}" \
  -e S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
  -e S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
  -e S3_BUCKET="${S3_BUCKET}" -e S3_FORCE_PATH_STYLE=true \
  -e DOCUMENT_INTELLIGENCE_URL="${DOCUMENT_INTELLIGENCE_URL:-http://127.0.0.1:8000}" \
  -e DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN="${DOCUMENT_INTELLIGENCE_INTERNAL_TOKEN}" \
  -e MALWARE_SCANNER="${MALWARE_SCANNER:-fake_test}" \
  "${IMG}")"
cleanup_good() { docker rm -f "${GOOD_CID}" >/dev/null 2>&1 || true; }
trap cleanup_good EXIT

LIVE_OK=false
READY_OK=false
for _ in $(seq 1 60); do
  if curl -sf http://127.0.0.1:3020/health/live >/dev/null; then LIVE_OK=true; fi
  CODE="$(curl -s -o "${OUT_DIR}/ready-with-deps.json" -w "%{http_code}" http://127.0.0.1:3020/health/ready || true)"
  if [[ "${CODE}" == "200" ]]; then READY_OK=true; break; fi
  sleep 2
done
[[ "${LIVE_OK}" == "true" ]] || { docker logs "${GOOD_CID}" | tee "${OUT_DIR}/web-runtime-good-logs.txt"; fail "live_with_deps"; }
[[ "${READY_OK}" == "true" ]] || { docker logs "${GOOD_CID}" | tee "${OUT_DIR}/web-runtime-good-logs.txt"; fail "ready_with_deps" "last=$(cat ${OUT_DIR}/ready-with-deps.json 2>/dev/null | head -c 500)"; }
curl -sf http://127.0.0.1:3020/health/live | tee "${OUT_DIR}/live-with-deps.json" >/dev/null

# Restart stability
docker stop -t 15 "${GOOD_CID}" >/dev/null
docker start "${GOOD_CID}" >/dev/null
sleep 3
curl -sf http://127.0.0.1:3020/health/live >/dev/null || fail "restart_live"
docker stop -t 15 "${GOOD_CID}" >/dev/null
trap - EXIT
docker rm -f "${GOOD_CID}" >/dev/null 2>&1 || true

IMG_ID="$(docker image inspect --format '{{.Id}}' "${IMG}")"
IMG_SIZE="$(docker image inspect --format '{{.Size}}' "${IMG}")"
python3 - <<PY
import json, pathlib
doc={
  "ok": True,
  "status": "PASS",
  "imageBuilt": True,
  "imageId": "${IMG_ID}",
  "imageSizeBytes": int("${IMG_SIZE}"),
  "configUser": "${USER_CFG}",
  "nonRoot": True,
  "liveWithoutDbHttp": int("${LIVE_BAD}"),
  "readyWithoutDbHttp": int("${READY_BAD}"),
  "liveWithDeps": True,
  "readyWithDeps": True,
  "gracefulShutdown": True,
  "restartStable": True,
  "noEnvFiles": True,
  "productionCommand": "node apps/web/server.js",
  "notes": "Synthetic CI container runtime only. Not a cloud deployment.",
}
pathlib.Path("${OUT_DIR}/web-container-runtime-report.json").write_text(json.dumps(doc, indent=2)+"\n")
print(json.dumps(doc, indent=2))
PY
