#!/usr/bin/env bash
# Start MinIO (+ optional ClamAV) as explicit docker run sidecars (Option B).
# Postgres/Redis remain GitHub Actions service containers.
# Official minio/minio cannot be used under GHA services: — it requires
# `server /data` and services: does not support command overrides.
#
# minio/mc ENTRYPOINT is `mc`. Never pass `/bin/sh` as a trailing argument;
# use `--entrypoint /bin/sh` (image includes a shell) or invoke `mc` subcommands.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/container-images.env"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/sidecar-helpers.sh"

MINIO_USER="${S3_ACCESS_KEY_ID:-ci-minio-access}"
MINIO_PASS="${S3_SECRET_ACCESS_KEY:-ci-minio-secret-ephemeral}"
MINIO_BUCKET="${S3_BUCKET:-contractradar-documents}"
START_CLAMAV="${START_CLAMAV:-true}"
CLAMAV_START_ATTEMPTED=false
FIRST_ERR_LINE=""
FIRST_ERR_STATUS=0

on_err() {
  local line="$1" status="${2:-1}"
  # Preserve the first failure; later diagnostic noise must not replace it.
  if [[ -z "${FIRST_ERR_LINE}" ]]; then
    FIRST_ERR_LINE="${line}"
    FIRST_ERR_STATUS="${status}"
  fi
  echo "ERROR: start-live-sidecars.sh failed near line ${FIRST_ERR_LINE} (exit ${FIRST_ERR_STATUS})"
  docker ps -a --filter name=contractradar-ci- --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || true
  safe_docker_logs contractradar-ci-minio 80
  if [[ "${CLAMAV_START_ATTEMPTED}" == "true" ]]; then
    safe_docker_logs contractradar-ci-clamav 80
  else
    echo "ClamAV diagnostics skipped (startup not attempted)."
  fi
  exit "${FIRST_ERR_STATUS}"
}
trap 'status=$?; on_err $LINENO "$status"' ERR

echo "Runner: $(uname -a)"
echo "Docker: $(docker version --format '{{.Server.Version}}' 2>/dev/null || docker version | head -5)"
echo "Images: MINIO=${MINIO_IMAGE} MC=${MINIO_MC_IMAGE} CLAMAV=${CLAMAV_IMAGE} START_CLAMAV=${START_CLAMAV}"

echo "Pulling sidecar images..."
docker pull "${MINIO_IMAGE}"
docker pull "${MINIO_MC_IMAGE}"
if [[ "${START_CLAMAV}" == "true" ]]; then
  docker pull "${CLAMAV_IMAGE}"
fi

echo "Starting MinIO (${MINIO_IMAGE})..."
safe_docker_rm contractradar-ci-minio
docker run -d --name contractradar-ci-minio \
  -p 127.0.0.1:9000:9000 \
  -e "MINIO_ROOT_USER=${MINIO_USER}" \
  -e "MINIO_ROOT_PASSWORD=${MINIO_PASS}" \
  "${MINIO_IMAGE}" \
  server /data --console-address ":9001"

# Confirm the process stayed up (official image exits immediately without `server /data`).
sleep 2
if ! docker_container_running contractradar-ci-minio; then
  echo "ERROR: MinIO container is not running after start"
  docker ps -a --filter name=contractradar-ci-minio --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  safe_docker_logs contractradar-ci-minio 120
  exit 1
fi

wait_http() {
  local url="$1" name="$2" attempts="${3:-60}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if curl -fsS --max-time 3 "${url}" >/dev/null 2>&1; then
      echo "OK ${name}"
      return 0
    fi
    if ! docker_container_running contractradar-ci-minio; then
      echo "FAIL ${name}: MinIO container exited while waiting"
      safe_docker_logs contractradar-ci-minio 120
      return 1
    fi
    sleep 2
  done
  echo "FAIL ${name} not healthy at ${url}"
  safe_docker_logs contractradar-ci-minio 80
  return 1
}

wait_http "http://127.0.0.1:9000/minio/health/live" "minio" 45

echo "Initializing private MinIO bucket (${MINIO_BUCKET})..."
# Override ENTRYPOINT ["mc"] so /bin/sh is the process, not an mc argument.
# Share MinIO's network namespace so 127.0.0.1:9000 reaches the server.
docker run --rm \
  --network container:contractradar-ci-minio \
  --entrypoint /bin/sh \
  -e MINIO_USER="${MINIO_USER}" \
  -e MINIO_PASS="${MINIO_PASS}" \
  -e MINIO_BUCKET="${MINIO_BUCKET}" \
  "${MINIO_MC_IMAGE}" \
  -c '
    set -euo pipefail
    mc alias set local http://127.0.0.1:9000 "$MINIO_USER" "$MINIO_PASS"
    mc mb --ignore-existing "local/${MINIO_BUCKET}"
    mc anonymous set none "local/${MINIO_BUCKET}"
  '

echo "Verifying MinIO bucket privacy..."
# Authenticated listing must succeed.
docker run --rm \
  --network container:contractradar-ci-minio \
  --entrypoint /bin/sh \
  -e MINIO_USER="${MINIO_USER}" \
  -e MINIO_PASS="${MINIO_PASS}" \
  -e MINIO_BUCKET="${MINIO_BUCKET}" \
  "${MINIO_MC_IMAGE}" \
  -c '
    set -euo pipefail
    mc alias set local http://127.0.0.1:9000 "$MINIO_USER" "$MINIO_PASS"
    mc ls "local/${MINIO_BUCKET}" >/dev/null
    anon="$(mc anonymous get "local/${MINIO_BUCKET}" 2>/dev/null || true)"
    echo "anonymous_policy=${anon}"
    printf "%s" "${anon}" | grep -Eqi "(Access permission.*none|none)"
  '

# Unauthenticated path-style list/get must not succeed (expect 403/404/405, not 200).
unauth_code="$(curl -sS -o /tmp/minio-unauth.out -w '%{http_code}' \
  --max-time 5 \
  "http://127.0.0.1:9000/${MINIO_BUCKET}/" || true)"
echo "unauthenticated_list_http=${unauth_code}"
if [[ "${unauth_code}" == "200" ]]; then
  echo "ERROR: bucket appears publicly listable over HTTP"
  exit 1
fi
if [[ ! "${unauth_code}" =~ ^(301|302|307|400|401|403|404|405)$ ]]; then
  echo "ERROR: unexpected unauthenticated HTTP status ${unauth_code} (expected deny/redirect/error)"
  exit 1
fi
echo "OK private bucket verified"

# Idempotent re-init must succeed.
docker run --rm \
  --network container:contractradar-ci-minio \
  --entrypoint /bin/sh \
  -e MINIO_USER="${MINIO_USER}" \
  -e MINIO_PASS="${MINIO_PASS}" \
  -e MINIO_BUCKET="${MINIO_BUCKET}" \
  "${MINIO_MC_IMAGE}" \
  -c '
    set -euo pipefail
    mc alias set local http://127.0.0.1:9000 "$MINIO_USER" "$MINIO_PASS"
    mc mb --ignore-existing "local/${MINIO_BUCKET}"
    mc anonymous set none "local/${MINIO_BUCKET}"
  '
echo "OK bucket init idempotent"

if [[ "${START_CLAMAV}" != "true" ]]; then
  echo "ClamAV skipped (START_CLAMAV=${START_CLAMAV})."
  echo "Sidecars ready (MinIO only)."
  exit 0
fi

echo "Starting ClamAV (${CLAMAV_IMAGE}) — definition init can take several minutes..."
CLAMAV_START_ATTEMPTED=true
safe_docker_rm contractradar-ci-clamav
docker run -d --name contractradar-ci-clamav \
  -p 127.0.0.1:3310:3310 \
  "${CLAMAV_IMAGE}"

wait_clamav() {
  local attempts="${1:-90}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if ! docker_container_running contractradar-ci-clamav; then
      echo "FAIL clamav container exited while waiting (attempt ${i}/${attempts})"
      docker ps -a --filter name=contractradar-ci-clamav --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
      safe_docker_logs contractradar-ci-clamav 120
      return 1
    fi
    if docker exec contractradar-ci-clamav clamdscan --ping 3 >/dev/null 2>&1; then
      echo "OK clamav clamdscan --ping"
      return 0
    fi
    if docker exec contractradar-ci-clamav clamdcheck.sh >/dev/null 2>&1; then
      echo "OK clamav clamdcheck.sh"
      return 0
    fi
    sleep 2
  done
  echo "FAIL clamav did not become ready"
  docker ps -a --filter name=contractradar-ci-clamav --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  safe_docker_logs contractradar-ci-clamav 120
  return 1
}

wait_clamav 90

echo "Sidecars ready."
