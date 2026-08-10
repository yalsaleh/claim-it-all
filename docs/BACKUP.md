# Backup (Slice 9)

## Scope

Postgres + object storage manifests. Secrets are references only (not dump plaintext).

## Evidence path

Backups for Slice 9 are exercised in **synthetic CI against ephemeral Postgres + MinIO** —
not a real customer cloud (ADR-113). Evidence includes manifests, checksums, and
post-restore DB→object reference verification.

## Operator / CI

```bash
# Documented script entry points (Mode A / CI)
pnpm backup:run          # if wired; else scripts under scripts/backup/
```

Each run must emit a manifest: timestamp, environment class, checksums, pipeline identity.

## On failure

See [runbooks/backup-failure.md](./runbooks/backup-failure.md). Pilot readiness treats
recent successful backup as **non-waivable**.
