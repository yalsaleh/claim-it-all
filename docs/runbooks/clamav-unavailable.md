# Runbook — ClamAV unavailable

## Symptoms
Ingestion stuck in scan; CLEAN never returned; readiness scanner warnings/errors.

## Immediate actions
1. Confirm `MALWARE_SCANNER=clamav` and `CLAMAV_HOST` in restricted envs.
2. **Do not** switch to `fake_test` in PILOT/PRODUCTION.
3. Kill `connector_ingestion` / pause uploads until scanner healthy.
4. Restart clamd; verify signatures DB update if relevant.
5. Re-queue stuck scan jobs only after health confirmed.
