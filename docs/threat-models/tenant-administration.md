# Threat model — Tenant administration (Slice 9)

## Assets
- Tenant lifecycle state (ACTIVE / SUSPENDED / OFFBOARDING / ARCHIVED)
- Membership and role bindings
- Platform operator credentials and capabilities
- Audit trail of privilege changes
- Tenant limit configuration

## Threats and controls

| Threat | Control |
|--------|---------|
| Unauthorized tenant create/suspend | Operator capability + audit (ADR-106) |
| Silent impersonation of tenant owner | Explicit operator identity; no default impersonation |
| Cross-tenant privilege grant | FORCE RLS; membership composite FKs; adversarial tests |
| Resume without limit/policy checks | Resume re-validates limits + kill-switches (ADR-120/118) |
| Offboard deletes wrong tenant | Dual control; integrity verify; no UI break-glass purge (ADR-121) |
| Suspend bypass via connector/dispatch | Suspend blocks sync + dispatch paths |
| Break-glass hidden in admin UI | Break-glass out-of-band only (ADR-108) |

## Explicit non-goals
Real multi-tenant SaaS control plane deployment; product UI break-glass; autonomous legal-state changes during suspend/resume.
