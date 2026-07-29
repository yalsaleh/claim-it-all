# ADR-089 — Connector provider abstraction

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Live EDMS/email credentials are not required to design connector flows safely in CI, mirroring ADR-077 for delivery providers.

**Decision:** Provider-neutral connector adapters expose a narrow port: authenticate, list/fetch since checkpoint, normalize to import payloads, verify webhooks. Slice 8 operationalizes `fake` and `local_fixture` only. Production and staging reject fake/local providers at configuration and runtime. Future provider enum values (`email_imap`, `sharepoint`, `aconex`, etc.) are reserved—not wired in Slice 8.

**Consequences:** Adapters receive scoped credentials only; never full tenant models. Environment guards mirror delivery fake-provider policy.
