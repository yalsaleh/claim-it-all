#!/usr/bin/env bash
# Shared helpers for backup/migrate scripts (sourced, not executed).
# Prisma URLs often include ?schema=public which libpq/psql reject.

psql_url() {
  local url="${1:?}"
  # Strip query string for libpq tools.
  printf '%s\n' "${url%%\?*}"
}
