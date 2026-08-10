# ADR-134 — Cloud backup and isolated restore

## Status

Accepted (Slice 11)

## Decision

Pilot uses managed RDS automated backups + private S3 versioning/lifecycle for objects.
Restore rehearsals run in a **temporary isolated** environment; primary pilot infra is never destroyed for testing.

CI/MinIO restore is **not** accepted as cloud restore evidence.

## Consequences

`cloud-restore-rehearsal-report.json` is the first-class cloud restore artifact and remains
`NOT RUN` until an approved AWS restore target exists.
