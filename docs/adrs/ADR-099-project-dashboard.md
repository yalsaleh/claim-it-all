# ADR-099 — Project dashboard

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Project leads need an honest operational snapshot without implying legal finality or AI certainty.

**Decision:** The project dashboard aggregates counts and statuses from authoritative tables: ingestion health, open suggestions awaiting review, tracked deadlines (with epistemic labels), open operational alerts, connector sync lag. It shows calculation trails and source links where available. It does not display composite scores, win probabilities, or auto-confirmed entitlements. Empty or lagging connectors show explicit “data may be incomplete” states.

**Consequences:** UI copy reinforces human confirmation requirements. Dashboard queries respect project membership and FORCE RLS; no cross-project leakage in tenant-wide views.
