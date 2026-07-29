# ADR-068 — Attachment and bundle manifest

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Exports need immutable attachment ordering and checksums without altering originals.

**Decision:** NoticeAttachment tracks inclusion status; NoticeExportBundle records approved revision, attachment versions, checksums, languages, and recipient preparation snapshot. Originals are never mutated.

**Consequences:** Tampering is detectable via checksums.
