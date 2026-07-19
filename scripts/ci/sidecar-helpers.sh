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

# Validate `mc anonymous get` output on the GitHub runner (not inside minio/mc).
# Real output example:
#   Access permission for `local/contractradar-documents` is `private`
# Fail closed on empty/missing or non-private policies.
assert_minio_anonymous_private() {
  local anonymous_policy="${1:-}"
  printf 'anonymous_policy=%s\n' "${anonymous_policy}"
  if [[ -z "${anonymous_policy//[[:space:]]/}" ]]; then
    echo "ERROR: empty mc anonymous get output (fail closed)" >&2
    return 1
  fi
  local normalized
  normalized="$(printf '%s' "${anonymous_policy}" | tr '[:upper:]' '[:lower:]')"
  case "${normalized}" in
    *'is `private`'*|*'`private`'*)
      return 0
      ;;
    *'is `none`'*|*'`none`'*)
      return 0
      ;;
    *'is private'*|*'is none'*)
      return 0
      ;;
    *download*|*upload*|*public*|*readwrite*|*write-only*|*read-only*)
      echo "ERROR: MinIO bucket anonymous policy is not private: ${anonymous_policy}" >&2
      return 1
      ;;
    *)
      echo "ERROR: MinIO bucket is not private (unrecognized policy): ${anonymous_policy}" >&2
      return 1
      ;;
  esac
}
