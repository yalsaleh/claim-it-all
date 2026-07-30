# Runbook — Service startup failure

## Symptoms
Process exits on boot; readiness never becomes ready; crash loops.

## Immediate actions
1. Capture exit logs (redacted). Note `CONTRACTRADAR_ENV` / `APP_ENV`.
2. Run `pnpm production:validate` against the same env file (no secrets in output).
3. Confirm required deps: Postgres, Redis, object storage, ClamAV (if restricted).
4. Confirm fake/local providers are not set in PILOT/PRODUCTION.
5. Fix config; restart; verify readiness (ADR-112).

## Escalate if
Validation passes but process still crashes → treat as code/regression; open incident.
