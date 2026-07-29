# ADR-102 — No autonomous legal state mutation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Slice 8 adds schedulers, connectors, alerts, and dashboards that run continuously in the background.

**Decision:** Background jobs in this slice may import documents, update sync checkpoints, emit operational alerts/tasks, and refresh dashboard caches. They must never confirm `ProjectEvent` facts, approve rule applicability, activate or modify contractual deadlines, create approved notice content, authorize dispatch, or record contractual service. Legal transitions remain capability-gated human actions with audit, consistent with ADR-038, ADR-040, ADR-054, and ADR-074.

**Consequences:** Code review checklist for scheduler/connector PRs. Integration tests assert no legal-table writes from sync paths. Violations are treated as security defects.
