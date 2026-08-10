# ADR-132 — Cloud pilot deployment approval

## Status

Accepted (Slice 11)

## Decision

Real AWS pilot apply requires:

- exact release manifest with immutable digests
- exact Git SHA
- vulnerability policy result (including sharp decision)
- backup/restore evidence IDs when available
- pilot security review PASS/EXCEPTION
- approved deployment window
- human approver via GitHub Environment `pilot-cloud`
- Terraform `enable_deployment=true` + `deployment_approval_token`

Expired, cancelled, or SHA/digest-mismatched approvals fail closed.

## Consequences

CI may use synthetic approval fixtures for unit tests only. Actual cloud apply remains human-gated.
