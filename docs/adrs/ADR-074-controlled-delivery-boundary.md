# ADR-074 — Controlled delivery boundary

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Slice 6 stopped at export-ready bundles (ADR-073). Slice 7 adds dispatch without conflating export, provider delivery, or contractual service.

**Decision:** Dispatch is allowed only from an approved `NoticeDraftRevision` bound to an immutable `NoticeExportBundle`. `EXPORTED` remains export-ready, not sent. Package `SENT` may be set when the first successful dispatch attempt is recorded, alongside finer dispatch and receipt dimensions. `NotificationIntent` stays internal warnings only—never contractual dispatch.

**Consequences:** Delivery tables, authorization, and provider adapters are in scope. Autonomous send remains forbidden.
