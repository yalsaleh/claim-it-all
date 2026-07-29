# ADR-075 — Immutable dispatch package snapshot

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Provider payloads and audit evidence must not drift from the approved export the user authorized to send.

**Decision:** Before any send attempt, create an immutable `NoticeDispatchPackageSnapshot` that pins draft revision ID, export bundle ID, recipients, attachments, subject, artifact checksums, and generation metadata. Snapshots are append-only; corrections require a new snapshot and new authorization.

**Consequences:** Dispatch attempts, webhooks, and receipt records reference snapshot IDs. Re-sends after content change require re-approval and a new export bundle.
