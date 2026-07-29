# ADR-077 — Delivery provider abstraction

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Production SMTP/API credentials are not required to design, test, or demo controlled delivery safely.

**Decision:** Provider-neutral adapters expose a narrow send interface. Slice 7 operationalizes `fake` and `local_capture` only. Define SMTP/API-shaped ports without mandating live credentials. Future channels (`aconex`, `whatsapp`, `edms`, etc.) are enum values reserved for later slices—not wired in Slice 7.

**Consequences:** Adapters receive snapshot-derived payloads only, never full database models. Environment guards block fake providers outside dev/demo.
