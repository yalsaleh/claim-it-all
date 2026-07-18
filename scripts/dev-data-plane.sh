#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/infrastructure/docker/docker-compose.yml"

cmd="${1:-up}"

case "${cmd}" in
  up)
    docker compose -f "${COMPOSE_FILE}" up -d
    docker compose -f "${COMPOSE_FILE}" ps
    ;;
  down)
    docker compose -f "${COMPOSE_FILE}" down
    ;;
  logs)
    docker compose -f "${COMPOSE_FILE}" logs -f
    ;;
  ps)
    docker compose -f "${COMPOSE_FILE}" ps
    ;;
  *)
    echo "Usage: $0 {up|down|logs|ps}"
    exit 1
    ;;
esac
