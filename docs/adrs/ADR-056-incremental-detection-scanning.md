# ADR-056 — Incremental detection scanning

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Projects accumulate new document versions over time. Full rewrites of suggestion history would destroy reviewer work and audit trails; ignoring version identity would duplicate or miss content.

**Decision:** Detection scans are incremental by `DocumentVersion` (and related extraction artifacts). A run records which versions were considered. New suggestions may be appended for newly seen versions; historical `ProjectEventSuggestion` rows and their review outcomes are never overwritten in place. Re-scans of the same version are idempotent enough to avoid duplicate open suggestions when content hash / detector version / context match, but may append a new run record for audit.

**Consequences:** Orchestration must key on document version ids within tenant/project. Accepted/rejected suggestions stay durable. Detector upgrades that need re-evaluation create new suggestions or explicit re-review requests rather than mutating old rows.
