# ADR-042 — Deadline calculation trace

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** Every calculation stores a machine-readable ordered `DeadlineCalculationTrace` (or JSON steps array) with operation, inputs, outputs, assumption/warning flags. UI renders the full trail; reproducibility tests assert identical traces for identical inputs.
