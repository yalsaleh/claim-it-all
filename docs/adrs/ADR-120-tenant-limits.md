# ADR-120 — Tenant limits

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Pilot tenants can exhaust storage, AI quota, or connector fan-out and create noisy-neighbor
risk. Unlimited dispatch attempts or imports can also amplify incident blast radius.

## Decision

Enforce soft/hard limits via `evaluateTenantLimit` in `@contractradar/platform` for keys:

- `active_projects`, `users`, `storage_bytes`
- `monthly_imported_records`, `monthly_processed_pages`
- `connector_accounts`, `connector_scopes`
- `detection_runs`, `ai_requests`
- `notice_exports`, `dispatch_attempts`

Behavior:

1. Soft warning at configurable ratio (default 80%): `nearLimit=true`
2. Hard exceed: `{ allowed: false, code: 'LIMIT_EXCEEDED' }` — fail closed on mutative paths
3. Limit changes are audited platform-admin actions
4. Limits never silently drop or rewrite legal audit records
5. Suspended tenants (ADR-106) should not consume new mutative quota

Exact numeric defaults are environment/config concerns, not hardcoded legal policy.

## Consequences

- Predictable pilot capacity and clearer incident containment
- Metrics may count `LIMIT_EXCEEDED` with safe labels (ADR-111)
## Alternatives considered

- Soft limits only (log and continue) — rejected for storage/dispatch hard caps in pilot.
- Global only (no per-tenant) — rejected; noisy-neighbor isolation requires tenant keys.
- Deleting old audit rows to free quota — rejected (audit immutability).
