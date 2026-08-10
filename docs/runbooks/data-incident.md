# Runbook — Data incident

| | |
| --- | --- |
| **Trigger** | Suspected leakage, integrity failure, or unauthorized access to pilot data |
| **Severity** | Critical |

## First actions
1. Enable kill switches; suspend affected tenants if scoped.
2. Preserve logs/audit chains; do not purge.
3. Rotate exposed secrets via secret manager refs.
4. Follow [security-incident.md](./security-incident.md) + legal/privacy contacts.

## Verification
- Integrity check; RLS still forced; support sessions reviewed
- Backup currency confirmed for potential restore

## Escalation
Security lead + pilot owner + privacy contact immediately.

## Recovery / audit
Timeline, systems touched, tenants impacted, notifications issued.
