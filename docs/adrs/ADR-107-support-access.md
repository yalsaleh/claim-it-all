# ADR-107 — Support access

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Pilot support may need time-boxed visibility into a tenant to diagnose failures. Unbounded
impersonation would defeat tenancy, RLS, and audit guarantees. Standing cross-tenant keys
are unacceptable for PILOT/PRODUCTION.

## Decision

Support access is **ticketed, time-boxed, least-privilege, and audited**.

1. Request cites ticket ID, tenant, scope, duration (default max 8h), and approver
2. Scopes: `read_metadata` | `read_documents` | `replay_jobs` (choose narrowest sufficient)
3. Dual control: requester ≠ approver for PILOT/PRODUCTION
4. Issued grant/session is distinct from ordinary user sessions; all queries retain
   `tenant_id` and FORCE RLS
5. Every support action emits audit events with grant ID; document body access is
   minimized and logged
6. Grants auto-expire; early revoke is mandatory on incident close or suspicion
7. Support **never** enables fake providers, dispatches notices, or confirms legal state
8. Concurrent grants per tenant should be minimized; platform policy may cap active grants

The product UI must not offer silent “view as customer” without an active grant.

## Consequences

- Supportability without standing cross-tenant credentials
- Threat model: [support-access.md](../threat-models/support-access.md)
- Runbook: [support-access.md](../runbooks/support-access.md)
- Guide: [SUPPORT_ACCESS.md](../SUPPORT_ACCESS.md)
## Alternatives considered

- Standing cross-tenant service accounts — rejected (unbounded blast radius).
- In-product silent impersonation — rejected (fails dual control and customer trust).
- Full write access for support — rejected; replay_jobs is the maximum mutative scope.
