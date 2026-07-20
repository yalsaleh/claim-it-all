# ADR-047 — Deadline-status updater

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** An idempotent deterministic updater may transition ProjectDeadline status (UPCOMING→DUE_SOON→DUE_TODAY→OVERDUE) and append `DeadlineStatusHistory` / warning intents. It must not send messages, draft notices, alter calculations, or infer events. Prefer a web-side script/job first; ARQ/outbox optional for later.
