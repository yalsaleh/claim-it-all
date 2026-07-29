# ADR-100 — Portfolio authorization

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Multi-project contractors need portfolio views; aggregation must not expose projects the user cannot access.

**Decision:** Portfolio endpoints enumerate only projects where the caller holds an active membership with the required capability. Aggregates are computed per authorized project and merged in application code—never via SQL that bypasses row scope. Cross-project rollups omit redacted projects silently rather than revealing their existence to unauthorized users. Tenant admins see tenant-wide totals only when explicitly granted.

**Consequences:** Portfolio APIs mirror single-project authz tests. No opaque portfolio identifiers that encode hidden projects. FORCE RLS remains the backstop on all underlying tables.
