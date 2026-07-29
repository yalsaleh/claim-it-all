# ADR-088 — External record identity

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Connectors may deliver the same external item multiple times or with revised versions; imports must dedupe deterministically.

**Decision:** `ExternalRecord` identity is unique on `(connectorAccountId, connectorProjectScopeId, externalId, version)`. `externalId` is provider-stable; `version` captures provider revision or content hash when the source exposes one. Replays with the same composite key are idempotent; new versions create new rows linked to new document versions when content differs.

**Consequences:** Incremental sync and webhook replay are safe. Cross-scope or cross-account collisions are impossible by schema. FORCE RLS enforced.
