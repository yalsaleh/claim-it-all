# Runbook — Provider kill switch

| | |
| --- | --- |
| **Trigger** | Provider incident, suspicious outbound traffic, or pilot pause |
| **Severity** | High |

## First actions
1. Enable needed switches: `connector_ingestion`, `scheduled_synchronization`, `webhook_processing`, `email_delivery`, `ai_calls`.
2. Confirm admin operations UI / API shows enabled=true.
3. Verify no new outbound provider attempts.
4. Communicate to pilot contacts.

## Verification
- Kill-switch state audited; background jobs skip disabled capabilities
- Fake providers remain forbidden in PILOT

## Escalation
Security if suspected compromise; pilot owner for business pause.

## Recovery / audit
Re-enable only after explicit approval; log who/when/why.
