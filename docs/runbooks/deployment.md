# Runbook — Pilot deployment

| | |
| --- | --- |
| **Trigger** | Approved release candidate ready for pilot environment |
| **Severity** | High |

## First actions
1. Validate release manifest digests (reject `latest`).
2. Confirm `DeploymentApproval` APPROVED + unexpired for `releaseId`.
3. Run preflight; migrate with migrate role only.
4. Deploy immutable digests; smoke `/health/live` + `/health/ready`.

## Verification
- `release-manifest.json` + approval evidence retained
- Deployment rehearsal report PASS for synthetic CI; real pilot uses change ticket

## Escalation
Platform on migrate/smoke failure — do not continue.

## Recovery / audit
Follow [rollback.md](./rollback.md); never claim cloud deploy from synthetic rehearsal alone.
