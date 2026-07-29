# ADR-082 — Receipt acknowledgment model

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Provider delivery receipts, read receipts, and contractual notice service have different legal meanings.

**Decision:** Model receipt as layered evidence: provider delivery confirmation, optional recipient acknowledgment (portal/sign-off), and separate contractual-service attestation. Provider signals populate delivery/received dimensions only. They never auto-set contractually served.

**Consequences:** Reports distinguish transport proof from service proof. Missing acknowledgment stays visible; no default upgrade to served.
