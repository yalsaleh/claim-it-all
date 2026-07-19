# ADR-022 — Queue and worker choice (ARQ)

## Status
Accepted (Slice 2) · Updated (Slice 2B) — supersedes the open choice in ADR-014

## Decision
Use **ARQ** (async Redis queue) for Python document workers.

### Queue contract
All producers and the worker share one explicit queue name (env `ARQ_QUEUE_NAME`, default `contractradar:document-processing`). Do not rely on ARQ’s implicit `arq:queue` default in application code — dispatcher, HTTP enqueue, live tests, and `WorkerSettings.queue_name` must match.

### Compared
- Celery: powerful but heavier ops surface for this service
- RQ: sync-first
- Dramatiq: strong alternative; ARQ pairs cleanly with FastAPI asyncio
- ARQ: Redis-native, typed jobs, retries, low complexity

### Enqueue path (Slice 2B)
**Primary:** transactional outbox (ADR-025) → outbox dispatcher → ARQ.  
Job payloads contain IDs only. Workers re-verify tenant/project from Postgres under controlled RLS bypass.

**Legacy/admin:** `POST /internal/jobs/process-document` with `X-Internal-Token`. In staging/production, requests must also include `X-Internal-Timestamp` + `X-Internal-Signature` (HMAC-SHA256 over `timestamp.` + body, skew ≤ 300s). Browser sessions are never accepted as worker auth. Prefer network isolation so this route is not publicly reachable.

### Why not HTTP-only from the web app
Calling DI over HTTP from the accept transaction cannot atomically commit both the DB row and the queue message. Outbox provides durable intent; ARQ provides execution.
