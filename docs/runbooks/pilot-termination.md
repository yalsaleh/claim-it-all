# Runbook — Pilot termination

| | |
| --- | --- |
| **Trigger** | Pilot objectives complete, hard stop date, or irreversible risk |
| **Severity** | High |

## First actions
1. Execute [pilot-shutdown.md](./pilot-shutdown.md).
2. Export required audit/evidence; revoke deployment approvals.
3. Disable edge DNS/certs only after data handling plan confirmed.
4. Schedule retention/offboarding per ADR-121 — no ad-hoc deletes.

## Verification
- No active pilot approvals; kill switches on; tenants suspended or offboarded
- Evidence archive location recorded

## Escalation
Pilot owner for business confirmation; security for residual risk.

## Recovery / audit
Termination record: release SHAs, exception decisions, data disposition.
