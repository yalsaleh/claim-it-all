# Pilot-approved vulnerability exceptions

Real AWS pilot deploy requires an explicit, **SHA-bound** approval artifact when an
exception remains `UPSTREAM_BLOCKED`.

## Do not auto-approve

CI and agents must never write `PILOT_APPROVED_EXCEPTION` into
`security/vulnerability-exceptions.json` without a matching human artifact here.

## Artifact format

Create: `EXC-YYYY-NNN.<gitSha>.json` (full 40-char SHA).

Required fields:

| Field | Purpose |
|-------|---------|
| `exceptionId` | e.g. `EXC-2026-005` |
| `advisoryId` | Advisory identifier |
| `package` | Package name |
| `packageVersion` | Exact version |
| `dependencyPath` | Dependency path |
| `runtimeExposure` | How it can be reached in pilot |
| `exploitabilityAssessment` | Honest assessment |
| `mitigation` | Controls in place |
| `monitoring` | How it will be watched |
| `securityOwner` | Owner team/person |
| `approver` | Human approver identity |
| `approvalDate` | ISO date |
| `expiresAt` | ISO date |
| `remediationMilestone` | Target fix |
| `pilotEnvironment` | Must be `PILOT` |
| `releaseSha` | Must equal deploy SHA |
| `decision` | Must be `PILOT_APPROVED_EXCEPTION` |

See `SCHEMA.example.json`. Until a matching artifact exists for the deploy SHA,
`Cloud pilot deploy` remains **BLOCKED**.
