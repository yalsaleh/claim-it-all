# ADR-093 — Connector webhook processing

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** External systems may push change notifications; these must not become trusted legal facts without verification, analogous to ADR-080.

**Decision:** Treat connector webhooks as untrusted. Verify signatures or shared-secret HMAC, enforce replay protection via event IDs and timestamp windows, and map payloads to known `ConnectorProjectScope` rows only. Valid events enqueue import work—not domain mutations. Reject unknown scopes, stale replays, cross-tenant identifiers, and payloads that attempt to set legal state directly.

**Consequences:** Failed verification is logged and dropped. Webhook handlers update connector/sync dimensions only. FORCE RLS on webhook receipt tables.
