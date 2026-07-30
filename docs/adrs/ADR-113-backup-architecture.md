# ADR-113 — Backup architecture

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Pilot data (PostgreSQL + object storage) must be recoverable. Untested or undocumented
backups are insufficient for non-waivable pilot gates. Slice 9 must not pretend that
multi-region cloud DR is already live.

## Decision

Backup architecture for Mode A / CI evidence:

1. **PostgreSQL:** consistent logical dumps (design allows future PITR); include roles/
   RLS policies needed to restore isolation; encrypt backup artifacts at rest
2. **Object storage:** versioned copy or periodic sync of `originals` / evidence prefixes
   (quarantine optional); store checksum manifests
3. **Secrets:** never land in DB dumps as plaintext (references only per ADR-105); secret
   backends follow their own backup/rotation procedures
4. **CI proof:** backup scripts run against **ephemeral Postgres + MinIO in CI only** —
   not a real customer cloud account
5. Each backup writes a manifest: timestamp, environment class, checksums, operator/
   pipeline identity, schema migration head

Operator entry points are documented in [BACKUP.md](../BACKUP.md). Failures use runbook
[backup-failure.md](../runbooks/backup-failure.md).

## Consequences

- Restores are testable (ADR-114) without claiming production offsite replication
- Real multi-region DR remains ADR-115 design, not a live deployment claim
- Pilot checklist requires recent successful backup evidence
## Non-goals (Slice 9)

- Live multi-region replication
- Customer-cloud backup accounts
- Guaranteed T2 RPO/RTO in production (future)

Evidence path is CI + MinIO (+ ephemeral Postgres) only.
