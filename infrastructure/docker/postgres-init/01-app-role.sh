#!/bin/bash
set -euo pipefail
# Bootstrap role remains superuser for migrations.
# Application role is created by Prisma RLS migration as well; this init is a convenience
# for empty local clusters before migrate runs.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'contractradar_app') THEN
      CREATE ROLE contractradar_app LOGIN PASSWORD 'contractradar'
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
    END IF;
  END
  \$\$;
  GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO contractradar_app;
  GRANT USAGE ON SCHEMA public TO contractradar_app;
EOSQL
