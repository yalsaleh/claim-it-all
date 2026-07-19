#!/usr/bin/env bash
# Shared helpers for CI sidecar start/stop/diagnostics.
# Safe when containers were never created. Does not print secrets.

safe_docker_rm() {
  local name="$1"
  docker rm -f "${name}" >/dev/null 2>&1 || true
}

docker_container_exists() {
  local name="$1"
  docker inspect "${name}" >/dev/null 2>&1
}

docker_container_running() {
  local name="$1"
  docker ps --filter "name=^${name}$" --filter status=running --format '{{.Names}}' \
    | grep -qx "${name}"
}

safe_docker_logs() {
  local name="$1"
  local lines="${2:-80}"
  if ! docker_container_exists "${name}"; then
    echo "docker logs skipped: container ${name} does not exist"
    return 0
  fi
  docker logs --tail "${lines}" "${name}" 2>&1 \
    | sed -E 's/(secret|password|MINIO_ROOT_PASSWORD|key)=[^ ]+/\1=REDACTED/gi' || true
  return 0
}

# Stop CI sidecars without failing if they were never started.
# Always returns 0 so callers can preserve a prior failure exit code.
stop_live_sidecars() {
  safe_docker_rm contractradar-ci-minio
  safe_docker_rm contractradar-ci-clamav
  echo "Sidecars stopped."
  return 0
}
