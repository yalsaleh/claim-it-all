#!/usr/bin/env bash
# Start MinIO (+ optional ClamAV) as explicit docker run sidecars (Option B).
# Postgres/Redis remain GitHub Actions service containers.
# Official minio/minio cannot be used under GHA services: — it requires
# `server /data` and services: does not support command overrides.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/container-images.env"

MINIO_USER="${S3_ACCESS_KEY_ID:-ci-minio-access}"
MINIO_PASS="${S3_SECRET_ACCESS_KEY:-ci-minio-secret-ephemeral}"
MINIO_BUCKET="${S3_BUCKET:-contractradar-documents}"
START_CLAMAV="${START_CLAMAV:-true}"

on_err() {
  local line="$1"
  echo "ERROR: start-live-sidecars.sh failed near line ${line}"
  docker ps -a --filter name=contractradar-ci- --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}' || true
  docker logs --tail 80 contractradar-ci-minio 2>&1 \
    | sed -E 's/(secret|password|MINIO_ROOT_PASSWORD|key)=[^ ]+/\1=REDACTED/gi' || true
  if [[ "${START_CLAMAV}" == "true" ]]; then
    docker logs --tail 80 contractradar-ci-clamav 2>&1 || true
  fi
}
trap 'on_err $LINENO' ERR

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
docker rm -f contractradar-ci-minio >/dev/null 2>&1 || true
docker run -d --name contractradar-ci-minio \
  -p 127.0.0.1:9000:9000 \
  -e "MINIO_ROOT_USER=${MINIO_USER}" \
  -e "MINIO_ROOT_PASSWORD=${MINIO_PASS}" \
  "${MINIO_IMAGE}" \
  server /data --console-address ":9001"

# Confirm the process stayed up (official image exits immediately without `server /data`).
sleep 2
if ! docker ps --filter name=^contractradar-ci-minio$ --filter status=running --format '{{.Names}}' | grep -qx contractradar-ci-minio; then
  echo "ERROR: MinIO container is not running after start"
  docker ps -a --filter name=contractradar-ci-minio --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  docker logs --tail 120 contractradar-ci-minio 2>&1 \
    | sed -E 's/(secret|password|MINIO_ROOT_PASSWORD|key)=[^ ]+/\1=REDACTED/gi' || true
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
    # Fail fast if the container died mid-wait.
    if ! docker ps --filter name=^contractradar-ci-minio$ --filter status=running --format '{{.Names}}' | grep -qx contractradar-ci-minio; then
      echo "FAIL ${name}: MinIO container exited while waiting"
      docker logs --tail 120 contractradar-ci-minio 2>&1 \
        | sed -E 's/(secret|password|MINIO_ROOT_PASSWORD|key)=[^ ]+/\1=REDACTED/gi' || true
      return 1
    fi
    sleep 2
  done
  echo "FAIL ${name} not healthy at ${url}"
  docker logs --tail 80 contractradar-ci-minio 2>&1 \
    | sed -E 's/(secret|password|MINIO_ROOT_PASSWORD|key)=[^ ]+/\1=REDACTED/gi' || true
  return 1
}

wait_http "http://127.0.0.1:9000/minio/health/live" "minio" 45

echo "Initializing private MinIO bucket (${MINIO_BUCKET})..."
# Share MinIO's network namespace so mc can reach 127.0.0.1:9000 without host networking.
docker run --rm --network container:contractradar-ci-minio \
  -e MINIO_USER="${MINIO_USER}" \
  -e MINIO_PASS="${MINIO_PASS}" \
  -e MINIO_BUCKET="${MINIO_BUCKET}" \
  "${MINIO_MC_IMAGE}" \
  /bin/sh -c 'mc alias set local http://127.0.0.1:9000 "$MINIO_USER" "$MINIO_PASS" && mc mb --ignore-existing "local/${MINIO_BUCKET}" && mc anonymous set none "local/${MINIO_BUCKET}"'

if [[ "${START_CLAMAV}" != "true" ]]; then
  echo "ClamAV skipped (START_CLAMAV=${START_CLAMAV})."
  echo "Sidecars ready (MinIO only)."
  exit 0
fi

echo "Starting ClamAV (${CLAMAV_IMAGE}) — definition init can take several minutes..."
docker rm -f contractradar-ci-clamav >/dev/null 2>&1 || true
docker run -d --name contractradar-ci-clamav \
  -p 127.0.0.1:3310:3310 \
  "${CLAMAV_IMAGE}"

wait_clamav() {
  local attempts="${1:-90}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if ! docker ps --filter name=^contractradar-ci-clamav$ --filter status=running --format '{{.Names}}' | grep -qx contractradar-ci-clamav; then
      echo "FAIL clamav container exited while waiting (attempt ${i}/${attempts})"
      docker ps -a --filter name=contractradar-ci-clamav --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
      docker logs --tail 120 contractradar-ci-clamav 2>&1 || true
      return 1
    fi
    if docker exec contractradar-ci-clamav clamdscan --ping 3 >/dev/null 2>&1; then
      echo "OK clamav clamdscan --ping"
      return 0
    fi
    # Also accept the image's clamdcheck.sh when present.
    if docker exec contractradar-ci-clamav clamdcheck.sh >/dev/null 2>&1; then
      echo "OK clamav clamdcheck.sh"
      return 0
    fi
    sleep 2
  done
  echo "FAIL clamav did not become ready"
  docker ps -a --filter name=contractradar-ci-clamav --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  docker logs --tail 120 contractradar-ci-clamav 2>&1 || true
  return 1
}

wait_clamav 90

echo "Sidecars ready."
