# ADR-025 — Transactional outbox for ingestion jobs

## Status
Accepted (Slice 2B)

## Context
Upload completion previously attempted to enqueue an ARQ job after (or loosely around) the database accept transaction. Outside production, enqueue failures could soft-fail, leaving an accepted `DocumentVersion` / `QUEUED` processing run with no durable job. Postgres and Redis cannot share a single atomic transaction.

## Decision
Use a **transactional outbox** for `process_document_version` delivery:

1. The web app finalizes upload acceptance and creates an `OutboxEvent` in the **same Postgres transaction**.
2. Payload contains **IDs only** (`processingRunId`, `documentVersionId`, `correlationId`) — never document bytes or secrets.
3. A dedicated **outbox dispatcher** process (`python -m document_intelligence.outbox.dispatcher`) claims pending rows (`FOR UPDATE SKIP LOCKED`), enqueues ARQ with `_job_id = idempotencyKey`, and marks `DISPATCHED`.
4. Failures retry with backoff up to `OUTBOX_MAX_ATTEMPTS`, then `DEAD_LETTERED`.
5. Workers remain **idempotent** (at-least-once delivery).

FORCE RLS applies to `outbox_event`. Dispatcher uses the constrained worker DB role with controlled bypass, same model as the ARQ worker.

## Privilege / RLS trust boundary
- Runtime DB role: `contractradar_app` (`NOSUPERUSER`, `NOBYPASSRLS`). Never the PostgreSQL superuser.
- Dispatcher and ARQ worker set **transaction-local** `app.bypass_rls=on` via `set_config(..., true)` inside each DB transaction (`db.py`). This is the only supported infrastructure bypass path.
- Browser/API request code must not set `app.bypass_rls`; product paths use tenant GUC (`app.current_tenant_id`) under FORCE RLS.
- Dispatcher readiness is **not** PID liveness: CI must prove a successful outbox query + timestamp bind + Redis ping + heartbeat write before live E2E scenarios.

## Timestamp binding
Prisma `DateTime` maps to PostgreSQL `TIMESTAMP(3)` **without time zone**. Python/asyncpg must bind **naive UTC** datetimes (`utc_now_naive`). Timezone-aware values raise `asyncpg.DataError` / SQLSTATE `22000` and stall the dispatcher loop.

## Delivery guarantee
**At-least-once** enqueue to Redis/ARQ with idempotent consumers. Not exactly-once across Postgres+Redis.

## Consequences
- Lost-job window after accept is eliminated when the dispatcher is running.
- Operators must run the dispatcher alongside the ARQ worker and a readiness probe.
- Legacy `POST /internal/jobs/process-document` remains for admin/emergency use only (see ADR-022 / service auth notes).
