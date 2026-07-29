# ADR-079 — Recipient-level delivery status

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Package-level status alone hides partial failures and conflates transport with legal effect.

**Decision:** Track per-recipient dimensions separately: dispatch submitted, provider accepted, delivered (provider signal), received (recipient acknowledgment where available), and contractually served (human-confirmed—ADR-084). Aggregate package status summarizes attempts but does not collapse these axes.

**Consequences:** One failed recipient does not silently mark all others served. UI labels each state plainly; none implies the others.
