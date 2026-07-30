# Runbook — Backup failure

## Symptoms
Backup job non-zero exit; missing manifest; checksum mismatch.

## Immediate actions
1. Treat as pilot-readiness regression (non-waivable).
2. Do not declare environment pilot-ready until a successful backup exists.
3. Inspect pipeline logs (redacted); verify MinIO/CI target only for Slice 9 evidence.
4. Re-run backup; confirm manifest checksums.
5. Schedule restore test ([restore-procedure.md](./restore-procedure.md)).

## Note
Slice 9 backups are proven in **CI/MinIO**, not a real customer cloud.
