# ADR-051 — Detection context grouping

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Detectors and reviewers need bounded batches of related documents (e.g., a correspondence thread or scan window) without scanning the entire tenant corpus as one blob or leaking across projects.

**Decision:** Introduce `DetectionContextGroup` as a bounded, project-scoped grouping for a detection run or related suggestion set. Groups carry `tenant_id` and `project_id` and may only reference documents/evidence within that project. Cross-tenant and cross-project grouping is forbidden. Size and membership are bounded (document count / byte / suggestion limits) so a single group cannot become an unbounded corpus.

**Consequences:** Scan jobs and duplicate/merge logic operate within a group + project boundary. RLS and application authz must reject foreign tenant/project members. Incremental scans attach new document versions to new or extended groups without rewriting other tenants’ history.
