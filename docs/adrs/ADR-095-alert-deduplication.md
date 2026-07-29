# ADR-095 — Alert deduplication

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Schedulers and webhooks may re-emit the same underlying condition; operators must not be flooded with duplicates.

**Decision:** Deduplicate operational alerts on `(tenantId, projectId?, alertType, dedupeKey)` where `dedupeKey` is a stable hash of the triggering entity (scope, document version, job, etc.). An open alert with the same composite key is updated in place (`lastSeenAt`, `occurrenceCount`); resolved alerts may reopen on recurrence. Suppression requires explicit operator action with audit.

**Consequences:** Alert feeds remain readable under retry storms. Deduplication logic is deterministic and testable; no ML clustering.
