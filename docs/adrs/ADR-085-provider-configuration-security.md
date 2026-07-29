# ADR-085 — Provider configuration security

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Delivery credentials and webhook secrets are high-value targets; new Slice 7 tables hold dispatch and provider data.

**Decision:** Store provider configs and secrets outside plaintext application fields where possible; scope configs per tenant/project. Apply composite tenant/project FKs, service-layer checks, and **FORCE RLS** on all new delivery tables (snapshots, attempts, authorizations, recipient status, webhook events, provider configs).

**Consequences:** Cross-tenant dispatch or webhook injection is structurally blocked. Secret rotation and least-privilege capabilities are operational requirements.
