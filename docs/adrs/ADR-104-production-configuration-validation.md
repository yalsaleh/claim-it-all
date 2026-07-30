# ADR-104 — Production configuration validation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Restricted environments fail dangerously when secrets are placeholders, database roles
collapse onto a superuser, fake providers slip through, cookies are insecure, or backup
configuration is absent. Operators need a **redacted** readiness report before any pilot
traffic is admitted.

## Decision

Provide `validateProductionConfig` in `@contractradar/platform` returning
`{ ok, findings[], redactedConfig }`. Any `severity: error` sets `ok=false` and blocks
readiness for restricted environments.

Mandatory checks (policy-gated by ADR-103):

1. `DATABASE_URL` present; Redis + object storage required when restricted
2. Separate `DATABASE_MIGRATE_URL` with a **distinct** non-bootstrap runtime role
3. Runtime role must not be `postgres` / bootstrap-style in restricted envs
4. `BETTER_AUTH_SECRET` ≥ 32 chars and not a known placeholder
5. Default MinIO / document-intelligence credentials rejected when policy requires
6. `ALLOW_DEV_DEFAULTS` forbidden outside LOCAL/TEST/CI
7. `MALWARE_SCANNER=clamav` when policy requires ClamAV
8. Fake/local providers forbidden for connectors, notice delivery, and contract AI
9. Secure cookies required in PILOT/PRODUCTION
10. Backup configured warning when unmarked in restricted envs

Expose via operator command `pnpm production:validate` (or equivalent wrapper). Reports
must never echo secret values — always apply `redactSecretLike`.

## Consequences

- Mode A can prove configuration gates without deploying infrastructure.
- CI workflow `production-readiness` consumes the same validator.
- Passing validation is necessary but not sufficient for pilot activation (ADR-119).
- No real cloud production is claimed by Slice 9 documentation.
