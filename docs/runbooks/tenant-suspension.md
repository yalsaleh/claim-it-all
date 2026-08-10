# Runbook — Tenant suspension

| | |
| --- | --- |
| **Trigger** | Tenant-local abuse, data risk, non-payment hold, or incident containment |
| **Severity** | High |

## First actions
1. Suspend tenant per ADR-106 (admin capability required).
2. Enable tenant-scoped kill switches if available; else global pause if blast radius unclear.
3. Block new sessions; preserve data for investigation.
4. Notify pilot contacts with facts only (no speculative blame).

## Verification
- Tenant cannot authenticate/act; audits show suspension actor/time
- Other tenants unaffected (isolation check)

## Escalation
Security if cross-tenant suspicion; pilot owner for customer communication.

## Recovery / audit
UnsSuspend only with explicit approval; attach investigation reference.
