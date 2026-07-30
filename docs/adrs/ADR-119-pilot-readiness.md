# ADR-119 — Pilot readiness

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

“Ready for pilot” must be evidence-based, not a marketing checkbox. Some controls cannot
be waived without creating unacceptable tenancy or recoverability risk.

## Decision

Evaluate readiness with `evaluatePilotReadiness` / `defaultPilotChecklist` in
`@contractradar/platform`.

### Non-waivable requirements

- `tenant_isolation_tests`
- `recent_successful_backup`
- `successful_restore_test`
- `production_secrets_configured`
- `fake_providers_disabled`
- `runtime_db_role_restricted`
- `rls_forced`
- `incident_contacts_configured`
- `support_access_policy_configured`
- `audit_logging_operational`
- `monitoring_operational`

Statuses: `NOT_STARTED` | `IN_PROGRESS` | `BLOCKED` | `READY_WITH_EXCEPTIONS` |
`READY` | `EXPIRED`.

Rules:

- Non-waivable items **cannot** be cleared via `approvedException`
- Activation requires `canActivate=true`
- Checklists expire when evidence ages out (e.g., restore test older than policy window)

Guide: [PILOT_READINESS.md](../PILOT_READINESS.md). Slice 9 Mode A produces checklist
evidence; it does **not** execute a real customer pilot deploy.

## Consequences

- Next phase is **controlled pilot deployment** only after evidence
- Waivers that bypass non-waivable controls are defects
