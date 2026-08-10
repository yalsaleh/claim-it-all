# ADR-131 — AWS Secrets Manager for pilot

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-08-10 |

## Context

ADR-105 defines provider-neutral secret references (`env://`, `file://`, `vault://`, `sm://`).
Slice 11 targets AWS for the controlled cloud pilot and needs an in-repo resolver contract
for Secrets Manager without committing secret material.

## Decision

1. Persist only `sm://` references (optionally `sm://aws/{region}/{secret-id}`).
2. Resolve via AWS SDK / task role at runtime (`packages/platform` `aws-secrets`).
3. Terraform creates Secrets Manager placeholders; values set out-of-band.
4. PILOT rejects known fake/test secret markers (`assertPilotSecretValue`).
5. Logs never emit resolved secret bytes (`redactSecretLike`).

## Consequences

- Local/CI continue to use `env://` injection.
- Real cloud deploy requires task role permissions `secretsmanager:GetSecretValue` on pilot ARNs only.
- No Gmail/M365/SMTP secrets are created in this slice.
