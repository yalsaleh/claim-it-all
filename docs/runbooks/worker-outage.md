# Runbook — Worker outage

| | |
| --- | --- |
| **Trigger** | ARQ worker / outbox dispatcher heartbeat missing or queue depth climbing |
| **Severity** | High / Critical if backlog threatens SLA |

## First actions
1. Check Redis connectivity and queue names.
2. Inspect worker process / container logs (redacted).
3. Pause ingestion kill switch if poison messages suspected.
4. Restart worker once; avoid thundering herd retries.

## Verification
- Heartbeat restored; outbox lag decreasing
- No cross-tenant job leakage in samples

## Escalation
Platform; security if job payloads look tampered.

## Recovery / audit
Record restart times, kill-switch toggles, and queue depth charts.
