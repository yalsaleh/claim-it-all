# Runbook — Pilot shutdown

| | |
| --- | --- |
| **Trigger** | Planned end of pilot window or emergency stop |
| **Severity** | High |

## First actions
1. Enable kill switches: connectors, sync, webhooks, delivery, AI, detection, export as needed.
2. Drain workers; stop accepting new uploads if data risk.
3. Snapshot evidence (`artifacts/pilot-readiness/`, audit exports).
4. Power down edge only after app/workers stopped.

## Verification
- `/health/ready` fails closed once dependencies stopped
- No outbound provider calls (delivery/connectors remain OFF)

## Escalation
Pilot owner + security for unplanned shutdown.

## Recovery / audit
Retain shutdown timestamp, kill-switch states, and who authorized.
