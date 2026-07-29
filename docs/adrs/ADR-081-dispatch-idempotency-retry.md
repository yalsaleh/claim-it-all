# ADR-081 — Dispatch idempotency and retry

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Network and provider failures must not duplicate sends or auto-retry without human intent.

**Decision:** Each dispatch attempt carries an idempotency key scoped to snapshot, recipient, and attempt sequence. Retries create new attempt records with explicit user action and fresh keys—never silent background resend. Classify outcomes as success, retryable failure, or terminal failure.

**Consequences:** Duplicate provider accepts with the same key are deduplicated. Automatic resend loops are forbidden (ADR-086).
