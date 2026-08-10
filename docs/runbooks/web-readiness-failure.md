# Runbook — Web readiness failure

| | |
| --- | --- |
| **Trigger** | `/health/ready` non-200 while `/health/live` may still be 200 |
| **Severity** | Critical |

## First actions
1. Read readiness payload (dependency failures only — no secrets).
2. Check Postgres, Redis, object storage, DI as reported.
3. Do not mark pilot healthy on live-only.
4. If prolonged: enable relevant kill switches and page on-call.

## Verification
- Ready returns 200 with all required checks green
- Container runtime contract still holds (non-root, no `.env` in image)

## Escalation
Platform on-call; security if auth/config anomalies accompany failure.

## Recovery / audit
Attach readiness JSON + RELEASE_SHA to the incident record.
