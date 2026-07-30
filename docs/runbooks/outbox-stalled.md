# Runbook — Outbox stalled

## Symptoms
Outbox rows pending beyond SLO; downstream ARQ idle; ingestion lag alerts.

## Immediate actions
1. Check dispatcher process liveness and DB locks.
2. Inspect oldest pending rows (IDs only — no payloads with secrets).
3. Confirm Redis/ARQ healthy; see [queue-backlog.md](./queue-backlog.md).
4. If poison message suspected: quarantine job; do not delete audit/outbox history casually.
5. After fix: verify lag metric decreases; run reconcile dry-run if available.
