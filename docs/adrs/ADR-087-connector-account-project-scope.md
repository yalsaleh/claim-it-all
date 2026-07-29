# ADR-087 — Connector account and project scope

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Slice 8 introduces external connectors without granting cross-project access or bidirectional sync that could mutate legal state.

**Decision:** `ConnectorAccount` binds tenant-scoped provider credentials and configuration. `ConnectorProjectScope` links an account to exactly one project only after explicit human approval. All scopes operate in `IMPORT_ONLY` mode: ingest documents and metadata into the existing pipeline; no outbound actions, event confirmation, deadline activation, or notice dispatch.

**Consequences:** Approval is auditable and revocable. Unscoped accounts cannot import. FORCE RLS on both tables. Connector UI shows scope status before any sync runs.
