#!/usr/bin/env bash
# Pull each required CI image independently. Fail with the exact failing image.
# Does not print credentials. Requires Docker on the runner (Mode B / validate-images job).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT_DIR}/scripts/ci/container-images.env"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required for image validation (GitHub-hosted runners provide it)."
  echo "Local Mode A does not require this script — use: pnpm verify:local"
  exit 1
fi

IMAGES=(
  "${POSTGRES_IMAGE}"
  "${REDIS_IMAGE}"
  "${MINIO_IMAGE}"
  "${MINIO_MC_IMAGE}"
  "${CLAMAV_IMAGE}"
)

echo "Validating ${#IMAGES[@]} container images (names only):"
for image in "${IMAGES[@]}"; do
  echo "  - ${image}"
done
echo ""

ARCH="$(uname -m)"
echo "Runner architecture: ${ARCH}"
echo ""

for image in "${IMAGES[@]}"; do
  echo "==> docker pull ${image}"
  if ! docker pull "${image}"; then
    echo "ERROR: docker pull failed for image: ${image}"
    exit 1
  fi
  # Best-effort architecture hint (do not fail if inspect format differs).
  docker image inspect "${image}" --format '{{.Os}}/{{.Architecture}}' 2>/dev/null \
    | sed "s|^|OK inspect ${image} -> |" || true
done

echo ""
echo "All required container images pulled successfully."
