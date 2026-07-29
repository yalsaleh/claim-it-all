# ADR-073 — No-delivery boundary

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** NotificationIntent and future connectors must not be conflated with contractual notice dispatch.

**Decision:** Slice 6 has no send, WhatsApp, email, EDMS, or connector job. Status EXPORTED means export-ready, not sent. Reserved SENT has no transition. UI never shows ready to send.

**Supersession (Slice 7):** ADR-074–086 add human-authorized delivery only. EXPORTED still ≠ sent; no autonomous send. Package SENT may be set when the first successful dispatch attempt is recorded, alongside finer dispatch/receipt dimensions.

**Consequences:** Slice 6 boundary preserved until Slice 7; delivery remains explicitly human-gated thereafter.
