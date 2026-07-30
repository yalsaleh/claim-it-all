# ADR-106 — Tenant administration

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Pilot operations need a controlled tenant lifecycle (create, suspend, resume, offboard)
without weakening FORCE RLS or inventing cross-tenant “god mode” inside the product UI.
Tenant admins (in-tenant RBAC) and platform operators must remain distinct identities with
distinct audit trails.

## Decision

Tenant administration is an **operator capability**, capability-gated and fully audited.

### Lifecycle

`ACTIVE` → `SUSPENDED` → (`ACTIVE` resume | `OFFBOARDING` → `ARCHIVED`)

| Transition | Effect |
|------------|--------|
| Suspend | Block interactive writes, connector sync, outbound dispatch; support reads only with ADR-107 grant |
| Resume | Re-check tenant limits (ADR-120), kill-switches (ADR-118), and provider policy |
| Offboard | Follow retention procedure (ADR-121); no silent purge |

### Controls

- Membership and role changes remain append-audited; no silent privilege elevation
- Platform/operator actions run under explicit operator identity — not default
  impersonation of the tenant owner
- Tenant limits apply at create/resume and on mutative quota paths
- Suspended tenants cannot approve connector scopes or authorize notice dispatch
- Break-glass elevation is out of band (ADR-108) and **not** exposed in product UI

## Consequences

- Clear separation between in-tenant admins and platform operators
- Threat model: [tenant-administration.md](../threat-models/tenant-administration.md)
- Guide: [TENANT_ADMINISTRATION.md](../TENANT_ADMINISTRATION.md)
- Mode A documents the model; no real multi-tenant SaaS ops console is claimed deployed
