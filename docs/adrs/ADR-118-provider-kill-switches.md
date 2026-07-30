# ADR-118 — Provider kill switches

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

During incidents, operators must stop ingestion, AI, delivery, webhooks, sync, detection,
or exports quickly without deploying code. Partial failure modes (poison messages, provider
outage) should not cascade into legal-state mutation.

## Decision

Standard kill-switch keys in `@contractradar/platform` (`KILL_SWITCH_KEYS`):

- `connector_ingestion`
- `ai_calls`
- `email_delivery`
- `webhook_processing`
- `scheduled_synchronization`
- `background_detection`
- `export_generation`

Switches may be **global** or **per-tenant**. When active, `isKillSwitchActive` causes
the capability to fail closed (no-op or explicit error). Activation/deactivation is audited
with reason. Kill switches:

- never confirm events, approve rules, or activate deadlines
- never auto-send contractual notices
- compose into **pilot pause** (multiple switches) per runbook

Unauthenticated public toggles are forbidden; emergency activation follows support /
break-glass policies when normal operator auth is unavailable.

## Consequences

- Fast containment for provider and pipeline incidents
- Runbook: [pilot-pause.md](../runbooks/pilot-pause.md)
