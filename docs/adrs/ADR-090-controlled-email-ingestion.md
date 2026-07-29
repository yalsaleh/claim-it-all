# ADR-090 — Controlled email ingestion

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Email is a common correspondence channel but carries spoofing, over-broad mailbox access, and PII risks.

**Decision:** Email connectors require an approved `ConnectorProjectScope` with explicit mailbox or folder allowlists—not whole-tenant inboxes. Inbound messages normalize to attachments and metadata only; bodies become source documents through the standard ingestion path (ADR-091). No auto-classification into confirmed events. Sender/domain hints are provenance, not legal conclusions. Credentials are scoped, rotatable, and never logged.

**Consequences:** Misconfigured scopes fail closed. Email-specific tables inherit FORCE RLS. Live IMAP/SMTP wiring deferred; fake email fixtures exercise CI.
