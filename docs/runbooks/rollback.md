# Runbook — Rollback

| | |
| --- | --- |
| **Trigger** | Failed smoke, readiness regression, or security hold after deploy attempt |
| **Severity** | Critical |

## First actions
1. Stop forward deploy; revoke/expire current approval if needed.
2. Redeploy prior immutable digest (not `latest`).
3. If migrate forward-only conflict: engage [failed-migration.md](./failed-migration.md).
4. Enable kill switches if user impact unclear.

## Verification
- Prior release health ready; error budgets/alerts quieting
- Rollback report updated with timestamps

## Escalation
Platform lead + pilot owner within 15 minutes if not recovering.

## Recovery / audit
Preserve both release manifests, approval ids, and operator actions.
