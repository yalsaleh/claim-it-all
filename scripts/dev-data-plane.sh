#!/usr/bin/env bash
# Optional Compose helper. Ordinary local development does NOT require Docker.
# Authoritative live verification: GitHub Actions workflow live-ingestion.yml
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infrastructure/docker/docker-compose.yml"

cmd="${1:-up}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found."
  echo "Ordinary local development does not require Docker — use: pnpm verify:local"
  echo "For live ingestion verification, run the GitHub Actions workflow: Live ingestion"
  exit 1
fi

case "${cmd}" in
  up)
    echo "NOTE: Compose is optional. Prefer GitHub Actions live-ingestion for operational proof."
    docker compose -f "${COMPOSE_FILE}" up -d --build
    docker compose -f "${COMPOSE_FILE}" ps
    ;;
  down)
    docker compose -f "${COMPOSE_FILE}" down
    ;;
  down:volumes)
    docker compose -f "${COMPOSE_FILE}" down -v
    ;;
  logs)
    docker compose -f "${COMPOSE_FILE}" logs -f
    ;;
  ps)
    docker compose -f "${COMPOSE_FILE}" ps
    ;;
  *)
    echo "Usage: $0 {up|down|down:volumes|logs|ps}"
    exit 1
    ;;
esac
