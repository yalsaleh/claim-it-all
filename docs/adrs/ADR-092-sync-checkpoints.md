# ADR-092 — Sync checkpoints

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Incremental sync requires durable cursor state without treating sync success as legal confirmation.

**Decision:** `SyncCheckpoint` stores per-scope cursor tokens (timestamp, provider page token, or opaque cursor) updated only after successful import handoff to ingestion. Checkpoints are append-only history with one active pointer per scope. Scheduler jobs poll/import only; they never confirm project events, activate deadlines, assess receipt, or enqueue notice dispatch. Failed runs leave the prior checkpoint intact.

**Consequences:** Operators can inspect sync lag deterministically. Legal state remains human-gated (ADR-102). FORCE RLS on checkpoint tables.
