# ADR-114 — Restore testing

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Untested backups are fiction. Pilot readiness treats restore success as a **non-waivable**
requirement. Restores must prove data presence **and** continued tenant isolation.

## Decision

Periodically (and in CI workflow `backup-restore`) restore into an isolated ephemeral
environment:

1. Restore Postgres dump → apply pending migrations if the rehearsal scenario requires →
   run `integrity:check`
2. Restore object samples from the MinIO backup target → verify checksums against manifest
3. Confirm FORCE RLS still enforced with adversarial cross-tenant probes
4. Record a redacted evidence artifact for the pilot checklist item
   `successful_restore_test`
5. Never restore production dumps onto shared developer laptops with broad filesystem
   access or sync agents

Destructive tests run only on ephemeral CI resources or dedicated restore sandboxes.
Customer data restores follow [restore-procedure.md](../runbooks/restore-procedure.md)
under incident/DR authorization.

## Consequences

- Non-waivable pilot gate (ADR-119)
- Slice 9 evidence is **CI/MinIO only** — no real customer restore drills are claimed
- Guide: [RESTORE.md](../RESTORE.md)
## Non-goals (Slice 9)

- Restoring real customer production dumps in CI
- Declaring enterprise DR drills complete
- Automated restore onto shared developer workstations
