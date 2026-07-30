# Runbook — Database unavailable

## Symptoms
API 5xx; workers failing DB connect; readiness fail `CFG_DB_*` / connection errors.

## Immediate actions
1. Confirm Postgres reachability and credentials (do not log passwords).
2. Check connection limits / failover state of the managed instance.
3. Engage **pilot pause** if writes are partial or failing inconsistently.
4. Do not run destructive migrate while availability is unclear.
5. After restore of connectivity: `integrity:check`; spot-check RLS.

## Escalate if
Data corruption suspected → [restore-procedure.md](./restore-procedure.md) + DR lead.
