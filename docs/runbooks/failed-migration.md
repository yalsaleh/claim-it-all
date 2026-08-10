# Runbook — Failed migration

| | |
| --- | --- |
| **Trigger** | `prisma migrate deploy` (or verify) fails in pilot |
| **Severity** | Critical |

## First actions
1. Halt app rollout; keep prior digest serving if possible.
2. Capture migrate logs (redact secrets).
3. Do **not** run destructive reset in PILOT.
4. Assess forward-fix vs restore from backup ([restore-procedure.md](./restore-procedure.md)).

## Verification
- `migrate-verify` / integrity check after remediation
- App ready only after schema matches release migrationVersion

## Escalation
Platform + DBA-equivalent immediately.

## Recovery / audit
Record migration version attempted, error code, and decision (forward-fix / restore).
