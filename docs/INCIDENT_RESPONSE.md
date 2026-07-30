# Incident response (Slice 9)

## First moves

1. Classify severity (see [runbooks/security-incident.md](./runbooks/security-incident.md))
2. Engage kill-switches / [pilot-pause](./runbooks/pilot-pause.md)
3. Preserve audit and logs; redact secrets in communications
4. Rotate exposed secrets; revoke support grants / sessions
5. Break-glass only if locked out — **out-of-band**, not product UI

## Dependency outages

| Dependency | Runbook |
|------------|---------|
| Startup/config | [service-startup-failure](./runbooks/service-startup-failure.md) |
| Postgres | [database-unavailable](./runbooks/database-unavailable.md) |
| Redis | [redis-unavailable](./runbooks/redis-unavailable.md) |
| Object storage | [object-storage-unavailable](./runbooks/object-storage-unavailable.md) |
| ClamAV | [clamav-unavailable](./runbooks/clamav-unavailable.md) |
| Outbox / queue | [outbox-stalled](./runbooks/outbox-stalled.md), [queue-backlog](./runbooks/queue-backlog.md) |
| Audit integrity | [audit-integrity-failure](./runbooks/audit-integrity-failure.md) |

## Close-out

`production:validate`, `integrity:check`, restore evidence if data plane touched, update
pilot readiness.
