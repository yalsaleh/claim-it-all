# ADR-073 — No-delivery boundary

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** NotificationIntent and future connectors must not be conflated with contractual notice dispatch.

**Decision:** Slice 6 has no send, WhatsApp, email, EDMS, or connector job. Status EXPORTED means export-ready, not sent. Reserved SENT has no transition. UI never shows ready to send.

**Consequences:** Next slice may add human-authorized delivery only.
