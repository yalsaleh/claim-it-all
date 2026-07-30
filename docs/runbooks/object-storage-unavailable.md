# Runbook — Object storage unavailable

## Symptoms
Upload/download failures; worker promote/extract errors; readiness S3 checks fail.

## Immediate actions
1. Verify endpoint, bucket, and secret references (ADR-105) — not raw keys in tickets.
2. Pause uploads and connector ingestion kill-switches.
3. Do not point PILOT at MinIO defaults (`minioadmin`).
4. Confirm backup target is distinct from primary if investigating ransomware-like events.
5. After recovery: checksum spot-check recent `DocumentVersion` objects.
