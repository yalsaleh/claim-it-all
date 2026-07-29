# ADR-084 — Contractual service human confirmation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Provider delivery ≠ contractual notice service under most construction contracts.

**Decision:** Only an explicit human action may set contractually served on a recipient or package: confirming actor, timestamp, basis (manual proof, deemed-receipt review, or other labeled reason), and optional evidence reference. Automated webhooks, deeming calculators, and AI outputs cannot perform this transition.

**Consequences:** Compliance views can require served confirmation before downstream workflows. Audit trail separates send, deliver, and serve events.
