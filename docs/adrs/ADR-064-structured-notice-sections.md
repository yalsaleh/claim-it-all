# ADR-064 — Structured notice sections

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** A single unstructured blob cannot preserve provenance or exclude internal comments.

**Decision:** NoticeDraftRevision contains ordered NoticeDraftSection rows with provenance (fact/evidence/clause IDs), machineGenerated/humanEdited/internalOnly flags, and review status. Rendered documents are derived from sections.

**Consequences:** Export omits internalOnly sections and comments.
