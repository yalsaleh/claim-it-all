# ADR-044 — Verified calculation immutability

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** After verification, `DeadlineCalculation` rows are immutable (DB trigger). Recalculation creates a new calculation referencing the previous one; tracked `ProjectDeadline` rows are superseded, never silently rewritten.
