#!/usr/bin/env bash
# Start MinIO + ClamAV as explicit docker run sidecars (Option B).
# Postgres/Redis remain GitHub Actions service containers.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/container-images.env"

MINIO_USER="${S3_ACCESS_KEY_ID:-ci-minio-access}"
MINIO_PASS="${S3_SECRET_ACCESS_KEY:-ci-minio-secret-ephemeral}"

echo "Pulling sidecar images..."
docker pull "${MINIO_IMAGE}"
docker pull "${MINIO_MC_IMAGE}"
docker pull "${CLAMAV_IMAGE}"

echo "Starting MinIO (${MINIO_IMAGE})..."
docker rm -f contractradar-ci-minio >/dev/null 2>&1 || true
docker run -d --name contractradar-ci-minio \
  -p 9000:9000 \
  -e "MINIO_ROOT_USER=${MINIO_USER}" \
  -e "MINIO_ROOT_PASSWORD=${MINIO_PASS}" \
  "${MINIO_IMAGE}" server /data --console-address ":9001"

echo "Starting ClamAV (${CLAMAV_IMAGE}) — definition init can take several minutes..."
docker rm -f contractradar-ci-clamav >/dev/null 2>&1 || true
docker run -d --name contractradar-ci-clamav \
  -p 3310:3310 \
  "${CLAMAV_IMAGE}"

wait_http() {
  local url="$1" name="$2" attempts="${3:-60}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if curl -fsS --max-time 3 "${url}" >/dev/null 2>&1; then
      echo "OK ${name}"
      return 0
    fi
    sleep 2
  done
  echo "FAIL ${name} not healthy at ${url}"
  docker logs --tail 80 contractradar-ci-minio 2>&1 | sed -E 's/(secret|password|key)=[^ ]+/\\1=REDACTED/gi' || true
  return 1
}

wait_clamav() {
  local attempts="${1:-90}"
  local i
  for i in $(seq 1 "${attempts}"); do
    # Prefer clamdscan --ping inside the container when available.
    if docker exec contractradar-ci-clamav clamdscan --ping 3 >/dev/null 2>&1; then
      echo "OK clamav clamdscan --ping"
      return 0
    fi
    # Fallback: TCP accept on published port (still not "running-only").
    if (echo >/dev/tcp/127.0.0.1/3310) >/dev/null 2>&1; then
      # Port open but ping not ready yet — keep waiting until ping or timeout.
      :
    fi
    sleep 2
  done
  echo "FAIL clamav did not become ready"
  docker ps -a --filter name=contractradar-ci-clamav --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true
  docker logs --tail 120 contractradar-ci-clamav 2>&1 | sed -E 's/(secret|password|key)=[^ ]+/\\1=REDACTED/gi' || true
  return 1
}

wait_http "http://127.0.0.1:9000/minio/health/live" "minio" 45
wait_clamav 90

echo "Initializing private MinIO bucket..."
docker run --rm --network host \
  -e MINIO_USER="${MINIO_USER}" \
  -e MINIO_PASS="${MINIO_PASS}" \
  "${MINIO_MC_IMAGE}" \
  /bin/sh -c 'mc alias set local http://127.0.0.1:9000 "$MINIO_USER" "$MINIO_PASS" && mc mb --ignore-existing local/contractradar-documents && mc anonymous set none local/contractradar-documents && mc anonymous get local/contractradar-documents | grep -qi none'

echo "Sidecars ready."
