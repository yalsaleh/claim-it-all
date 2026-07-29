# ADR-066 — AI-assisted drafting boundary

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** AI may improve phrasing but must not invent legal content.

**Decision:** Provider-neutral adapter returns structured sections with source IDs and warnings. Reject invented facts/dates/clauses/recipients/amounts, deadline changes, internal comments, and malformed output. Fake providers are test-only. No chain-of-thought storage.

**Consequences:** Deterministic validation remains authoritative after AI assistance.
