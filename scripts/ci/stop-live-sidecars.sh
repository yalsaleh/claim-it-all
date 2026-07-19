#!/usr/bin/env bash
set -euo pipefail
docker rm -f contractradar-ci-minio contractradar-ci-clamav >/dev/null 2>&1 || true
echo "Sidecars stopped."
