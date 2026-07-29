# ADR-080 — Provider webhook processing

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Delivery providers emit asynchronous events that must not become trusted legal facts without verification.

**Decision:** Treat all inbound webhooks as untrusted. Verify provider signatures (or shared-secret HMAC where applicable), enforce replay protection via event IDs and timestamp windows, and map events to known dispatch attempts only. Reject unknown attempts, stale replays, and cross-tenant identifiers.

**Consequences:** Webhook handlers update provider delivery dimensions only—not contractual service. Failed verification is logged and dropped; no partial state mutation.
