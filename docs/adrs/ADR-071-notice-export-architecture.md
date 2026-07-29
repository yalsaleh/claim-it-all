# ADR-071 — Export architecture

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Teams need export-ready packages without platform delivery.

**Decision:** Support PDF, DOCX, JSON manifest, attachment ZIP, and plain-text preview from approved revisions only. Artifacts carry checksum, generation timestamp, draft revision, and template version. No digital signing or sending.

**Consequences:** Delivery integrations remain a future slice.
