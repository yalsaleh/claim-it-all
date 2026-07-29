# ADR-096 — Escalation policies

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Unresolved operational conditions may need broader visibility without conflating internal escalation with contractual notice.

**Decision:** `EscalationPolicy` defines tenant-configured thresholds and recipient roles for operational alerts only—e.g., notify project admin after N hours of sync failure. Escalations create `InternalNotification` rows or in-app tasks; they never create `NotificationIntent` for contractual dispatch or enqueue notice send jobs. Policies require capability-gated configuration and audit on change.

**Consequences:** Human operators receive reminders; legal workflows stay separate (ADR-098). No autonomous escalation to external counterparties.
