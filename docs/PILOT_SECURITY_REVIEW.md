# Pilot security review checklist

Honesty label: **checklist scaffolding**. Completing rows here is not automatic go-live approval.

Statuses: `PASS` | `FAIL` | `EXCEPTION` | `NOT_APPLICABLE`

## Non-waivable blockers

These cannot be waived with “temporary accept”:

- Tenant isolation / RLS forced
- Fake providers disabled in PILOT
- Production-strength secrets configured (no `ALLOW_DEV_DEFAULTS`)
- Runtime DB role restricted (migrate role separated)
- Backup + restore evidence present and recent
- Audit logging operational
- Kill switches operable
- Active `FIX_BEFORE_PILOT` or expired vulnerability exceptions
- Active critical **runtime** vulnerability without fix
- `UPSTREAM_BLOCKED` without recorded `PILOT_APPROVED_EXCEPTION`

## Checklist

| ID | Control | Status | Evidence / notes |
| --- | --- | --- | --- |
| PSR-01 | Environment class is PILOT (not PRODUCTION default for scaffolding tools) | | |
| PSR-02 | Secrets are references / vault-backed; none committed | | |
| PSR-03 | TLS terminated; HSTS enabled at edge | | |
| PSR-04 | Fake providers rejected by production validation | | |
| PSR-05 | AI / connectors / delivery OFF by default | | |
| PSR-06 | Release manifest uses immutable digests (no `latest`) | | |
| PSR-07 | Deployment approval recorded and unexpired | | |
| PSR-08 | Vulnerability burndown reviewed (`docs/security/VULNERABILITY_BURNDOWN.md`) | | |
| PSR-09 | Sharp UPSTREAM_BLOCKED has `PILOT_APPROVED_EXCEPTION` or is fixed | | |
| PSR-10 | Vitest/Vite accepted only as DEV_ONLY | | |
| PSR-11 | Web `/health/live` vs `/health/ready` contract verified | | |
| PSR-12 | Worker / outbox runbooks available | | |
| PSR-13 | Incident + data-incident runbooks available | | |
| PSR-14 | Pilot termination / tenant suspension runbooks available | | |
| PSR-15 | Monitoring alert definitions + dedupe path configured | | |
| PSR-16 | Support access / break-glass policy understood | | |

## Sign-off

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Security | | | |
| Platform | | | |
| Pilot owner | | | |

Decision must explicitly state whether any `EXCEPTION` rows are `PILOT_APPROVED_EXCEPTION` with expiry.
