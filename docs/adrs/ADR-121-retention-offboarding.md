# ADR-121 — Retention and offboarding

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Suspended or departing tenants require export, retention holds, and eventual deletion
without breaking audit immutability prematurely or deleting the wrong tenant’s objects.

## Decision

Offboarding phases:

1. **Suspend** — block writes/connectors/dispatch (ADR-106)
2. **Export** — tenant-scoped evidence pack (metadata + permitted documents) to an
   encrypted transfer location; checksum manifest retained
3. **Retention hold** — legal/audit hold may pause purge clocks
4. **Purge** — delete tenant-owned objects and live rows per policy; retain audit events
   for the compliance window or replace with anonymized tombstones where required
5. **Verify** — integrity check that no `tenant_id` rows remain in live tables; backup
   media handled per retention schedule

Controls:

- No silent cross-tenant deletes; destructive ops require dual control in PILOT/PRODUCTION
- Product UI does not offer break-glass purge
- Object storage deletes respect versioning until retention expires

## Consequences

- Aligns with SECURITY retention themes
- Detailed schedules are customer/contract specific; engineering provides mechanized hooks
  and runbooks
## Alternatives considered

- Immediate hard delete on suspend — rejected (export/hold requirements).
- Operator UI “purge now” without dual control — rejected for PILOT/PRODUCTION.
- Keeping object storage forever without policy — rejected (cost + privacy).
