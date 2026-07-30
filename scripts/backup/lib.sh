#!/usr/bin/env bash
# Shared helpers for backup/migrate scripts (sourced, not executed).
# Prisma URLs often include ?schema=public which libpq/psql reject.

psql_url() {
  local url="${1:?}"
  # Strip query string for libpq tools.
  printf '%s\n' "${url%%\?*}"
}

# Run MinIO client. Prefer host `mc`; otherwise use pinned minio/mc via Docker
# (GitHub CI starts MinIO as a sidecar and does not install mc on the runner).
mc_run() {
  if command -v mc >/dev/null 2>&1; then
    mc "$@"
    return $?
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: neither mc nor docker available for object backup/restore" >&2
    return 127
  fi
  local root_dir images_env mc_image
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  images_env="${root_dir}/scripts/ci/container-images.env"
  # shellcheck disable=SC1090
  source "${images_env}"
  mc_image="${MINIO_MC_IMAGE:?MINIO_MC_IMAGE required}"
  # Mount workspace so mirror/cp can read/write backup artifacts; use host network
  # so 127.0.0.1:9000 reaches the MinIO sidecar published on the runner.
  docker run --rm --network host \
    -v "${root_dir}:${root_dir}" \
    -w "${root_dir}" \
    --entrypoint mc \
    "${mc_image}" \
    "$@"
}
