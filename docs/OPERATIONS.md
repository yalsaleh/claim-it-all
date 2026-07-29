# Operations guide (Slice 8)

Operational monitoring is separate from legal workflow state.

## Surfaces

| Route | Purpose |
|-------|---------|
| `/projects/[id]/operations` | Project counts from stored deadlines, notices, alerts, sync |
| `/projects/[id]/alerts` | Deterministic alerts (acknowledge / assign / resolve / dismiss) |
| `/projects/[id]/tasks` | Internal operational tasks |
| `/projects/[id]/connectors` | Project connector scopes and imports |
| `/portfolio` | Membership-filtered portfolio counts |
| `/connectors` | Tenant connector accounts |
| `/notifications` | In-app internal notifications |

## Boundaries

- Alert severity is operational risk, not legal-success probability.
- Completing a task or resolving an alert does **not** confirm events, verify dates, approve notices, or send notices.
- Internal notifications never share the contractual notice dispatch path.
- Dashboards show real counts only — no fabricated health scores or money-at-risk.

## Jobs

Outbox/ARQ may validate connectors, sync scopes, import records (via ingestion), evaluate alerts/escalations, reconcile stuck syncs, and rebuild summaries. Queue payloads are ID-only and secret-free.

## Related

- [CONNECTOR_PRIVACY.md](./CONNECTOR_PRIVACY.md)
- ADRs 094–102
