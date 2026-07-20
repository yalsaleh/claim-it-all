# ADR-053 — Duplicate merge semantics

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Historical scans will surface near-duplicate candidates across letters and emails. Silent auto-merge risks dropping evidence or consolidating distinct facts; refusing all linkage creates reviewer noise.

**Decision:** Duplicate/near-duplicate signals are advisory only. The system may propose links or merge candidates within the same project `DetectionContextGroup`, but only a human merge (or explicit accept-as-same) consolidates suggestions. Merges must preserve all evidence references and prior suggestion identities (append-only linkage / supersession metadata), never delete provenance. Cross-project or cross-tenant merge proposals are rejected.

**Consequences:** Deduplication helpers in `@contractradar/event-detection` return ranked advisory matches, not destructive unions. Audit records capture actor, reason, and preserved evidence set on human merge. Reviewer workload can be reduced without sacrificing custody.
