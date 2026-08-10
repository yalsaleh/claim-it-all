# ADR-133 — Cloud pilot rollback

## Status

Accepted (Slice 11)

## Decision

Application rollback in pilot uses immutable previous image digests on ECS services.
Database down-migrations are forbidden in pilot rollback rehearsals.

Rollback sequence:

1. Confirm unhealthy readiness / failed rollout
2. Redeploy previous image digests
3. Verify readiness + smoke subset
4. Verify data unchanged (no destructive schema changes)
5. Capture audit/log evidence

## Consequences

Rollback does not require provider disconnect because providers remain disabled in pilot.
