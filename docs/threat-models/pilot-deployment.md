# Threat model — Pilot deployment (Slice 9)

## Assets
- Pilot readiness checklist and evidence
- Pilot tenant data and limits
- Incident response contacts
- Support access policy configuration
- Backup/restore evidence artifacts

## Threats and controls

| Threat | Control |
|--------|---------|
| Pilot without isolation proof | Non-waivable `tenant_isolation_tests` / `rls_forced` (ADR-119) |
| Pilot without restore proof | Non-waivable backup + restore tests |
| Waiving non-waivable controls | `approvedException` rejected for non-waivable items |
| Fake providers in pilot | `fake_providers_disabled` required |
| Unlimited tenant growth | Tenant limits (ADR-120) |
| No support/incident path | Required checklist items for contacts + support policy |
| Silent go-live via docs | Explicit: Slice 9 does not execute real pilot deploy |
| Unsafe continue during incident | Pilot pause runbook + kill switches |

## Explicit non-goals
Declaring a customer pilot live; real provider traffic; product UI break-glass.
