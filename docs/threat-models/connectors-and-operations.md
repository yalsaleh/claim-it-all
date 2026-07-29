# Threat model — Connectors and operations (Slice 8)

## Assets
- Connector credentials and webhook secrets
- `ConnectorAccount` / `ConnectorProjectScope` approval records
- `ExternalRecord` provenance and sync checkpoints
- Source documents and ingestion pipeline integrity
- Operational alerts, tasks, and internal notifications
- Dashboard and portfolio aggregates
- Tenant/project isolation and audit logs

## Threats and controls

| Threat | Control |
|--------|---------|
| Connector imports without project approval | `ConnectorProjectScope` requires explicit human approval; `IMPORT_ONLY` only (ADR-087) |
| Cross-project or cross-tenant import | Scope binds one project; composite FKs + FORCE RLS on all new tables |
| Parallel weak ingestion path | All imports through `SourceDocument`/`DocumentVersion`/outbox/ARQ (ADR-091) |
| Duplicate or replayed external records | Unique `(account, scope, externalId, version)`; idempotent handoff (ADR-088) |
| Webhook sets legal state directly | Untrusted webhooks; signature + replay window; enqueue import only (ADR-093) |
| Scheduler confirms events or deadlines | Sync jobs update checkpoints only; no legal-table writes (ADR-092, ADR-102) |
| Operational alert treated as notice dispatch | `OperationalAlert`/`InternalNotification`/`NotificationIntent` never enqueue dispatch (ADR-098) |
| Fake health scores or money-at-risk UI | Deterministic aggregates only; no composite scores (ADR-094, ADR-101) |
| Portfolio leaks unauthorized projects | Membership-filtered enumeration; silent omission (ADR-100) |
| Fake connector in production | Environment guard rejects `fake`/`local_fixture` outside CI (ADR-089) |
| Over-broad email mailbox access | Allowlisted folders per approved scope (ADR-090) |
| Credential theft / config leak | Scoped secrets; rotation; least-privilege capabilities; no logging |
| Alert flooding on retries | Deterministic dedupe keys (ADR-095) |
| Escalation sends contractual notice | Escalations create internal notifications/tasks only (ADR-096) |
| Operational task implies legal confirmation | Task completion is operator ack only (ADR-097) |
| Stale checkpoint hides sync failure | Append-only checkpoint history; alerts on lag thresholds |
| Dashboard cache serves cross-tenant data | Queries under FORCE RLS; membership-scoped portfolio merge |

## Explicit non-goals
No live EDMS/email connectors in production for Slice 8, autonomous event confirmation, deadline activation, notice dispatch, composite project health scores, predicted claim values, or cross-tenant portfolio visibility without membership.
