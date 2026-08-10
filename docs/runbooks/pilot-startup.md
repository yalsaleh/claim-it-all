# Runbook — Pilot startup

| | |
| --- | --- |
| **Trigger** | Approved pilot window start; release candidate + approval present |
| **Severity** | High (shared pilot environment) |

## First actions
1. Confirm `CONTRACTRADAR_ENV=PILOT`, `ALLOW_DEV_DEFAULTS=false`.
2. Run `PILOT_PREFLIGHT_SYNTHETIC=false pnpm pilot:preflight` (must not be BLOCKED).
3. Verify secrets resolved; AI/connectors/delivery still OFF unless explicitly approved.
4. Start data plane + web; confirm `/health/live` 200 and `/health/ready` 200.

## Verification
- `artifacts/pilot-readiness/pilot-preflight-report.json` status PASS or PASS_WITH_APPROVED_EXCEPTIONS
- Platform readiness READY/DEGRADED (no NOT_READY)

## Escalation
Platform + security if preflight BLOCKED or readiness NOT_READY.

## Recovery / audit
Record RELEASE_SHA, approval id, operator, and startup timestamp in incident/ops log.
