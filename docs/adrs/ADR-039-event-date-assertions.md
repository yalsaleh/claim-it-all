# ADR-039 — Event-date assertions

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** Represent trigger-relevant dates as `ProjectEventDate` rows with type, precision, verification status, and evidence — not only nullable columns on `ProjectEvent`. Only VERIFIED dates with EXACT_DATE or EXACT_DATETIME precision may drive deterministic calculation.
