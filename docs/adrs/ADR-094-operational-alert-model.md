# ADR-094 — Operational alert model

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Operators need visibility into ingestion lag, sync failures, and review backlog without fabricating legal or commercial conclusions.

**Decision:** `OperationalAlert` records deterministic conditions derived from known system states: e.g., sync stalled beyond threshold, ingestion dead-letter, review queue age, connector auth failure. Each alert cites concrete source rows and thresholds—no composite health scores, predicted claim values, or “money at risk” estimates. Alerts are ADVISORY and never trigger notice dispatch or legal state transitions.

**Consequences:** Dashboards can list explainable alerts with deep links. Fake alert generators are test-only. FORCE RLS on alert tables.
