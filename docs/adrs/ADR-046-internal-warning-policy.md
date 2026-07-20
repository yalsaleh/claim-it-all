# ADR-046 — Internal warning policy

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** `DeadlineWarningPolicy` defines internal offsets only. Internal milestones are labeled INTERNAL/ADVISORY and never alter contractual deadlines. No outbound messaging in Slice 4; optional `NotificationIntent` records FUTURE_DELIVERY only.
