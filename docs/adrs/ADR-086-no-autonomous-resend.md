# ADR-086 — No autonomous resend

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Background retry of failed notices risks duplicate service and waiver disputes.

**Decision:** The platform performs no autonomous resend, scheduled retry, or AI-triggered resend. Each new transmission requires fresh human authorization and an explicit send or manual-dispatch action. `NotificationIntent` may surface internal delivery-risk warnings but must never enqueue contractual dispatch.

**Consequences:** Failed attempts remain visible until a user acts. Retry UX creates a new attempt; it does not mutate or hide the failed one.
