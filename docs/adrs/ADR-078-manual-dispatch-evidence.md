# ADR-078 — Manual dispatch evidence

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Many notices are served outside integrated channels (hand delivery, counsel post, client portal upload).

**Decision:** Manual dispatch is first-class: a human records channel, timestamp, reference, optional proof document version, and notes against an authorized snapshot. Manual records participate in the same attempt and recipient-status model as provider sends. No provider webhook is required.

**Consequences:** UI and APIs treat manual and automated attempts uniformly for audit. Contractual-service confirmation remains a separate human step (ADR-084).
