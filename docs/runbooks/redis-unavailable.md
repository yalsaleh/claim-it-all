# Runbook — Redis unavailable

## Symptoms
Login rate limit / queues / sessions degraded; workers cannot claim jobs.

## Immediate actions
1. Confirm Redis endpoint and auth; restart client pools if needed.
2. In restricted envs, auth rate limiting is fail-closed — expect login denials.
3. Pause non-critical enqueue (kill `scheduled_synchronization` / connector ingestion).
4. Avoid switching to in-memory rate limit in PILOT/PRODUCTION.
5. When Redis returns: drain backlog via [queue-backlog.md](./queue-backlog.md).
