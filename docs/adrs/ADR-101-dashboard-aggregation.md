# ADR-101 — Dashboard aggregation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Summaries across projects must stay explainable and auditable; opaque scoring creates false precision.

**Decision:** Dashboard aggregates use deterministic SQL/application reductions: counts by status, oldest-open-item age, sum of explicitly labeled fields. Each aggregate widget declares its source query and filter predicates in API metadata for debugging. No weighted health index, ML risk score, or normalized 0–100 “project health.” Commercial exposure ranges remain deferred to Phase 4 with explicit epistemic labeling when introduced.

**Consequences:** Widgets can be unit-tested against fixtures. Portfolio view inherits ADR-100 membership filters. Performance via indexed status columns, not materialized guess tables.
