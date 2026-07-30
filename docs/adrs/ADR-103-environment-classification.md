# ADR-103 — Environment classification

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Slice 9 must distinguish local/test tooling from pilot and production controls. Legacy
`APP_ENV` / `NODE_ENV` strings are inconsistent (`development`, `prod`, CI flags). Fake
providers, debug routes, default credentials, and test GUCs are acceptable in some classes
and forbidden in others. Mis-labeling a pilot runtime as `LOCAL` would silently disable
critical gates.

## Decision

Classify every process into exactly one of:

`LOCAL` · `TEST` · `CI` · `STAGING` · `PILOT` · `PRODUCTION`

Resolution order (see `@contractradar/platform`):

1. `CONTRACTRADAR_ENV` if set
2. Else `CI=true` → `CI` (unless `APP_ENV` overrides)
3. Else `APP_ENV` / `NODE_ENV` with compatibility mapping
4. Else `LOCAL`

Each class exposes a `ProviderPolicy` covering: fake providers, local-capture providers,
test purge GUCs, debug routes, dev auth shortcuts, strong secrets, ClamAV requirement,
migrate-role separation, and default-credential rejection.

| Environment | Fake providers | Local capture | Strong secrets / ClamAV | Default creds |
|-------------|----------------|---------------|-------------------------|---------------|
| LOCAL/TEST  | allowed        | allowed       | not required            | allowed       |
| CI          | allowed        | allowed       | migrate role sep.       | allowed       |
| STAGING     | forbidden      | allowed       | required                | forbidden     |
| PILOT/PROD  | forbidden      | forbidden     | required                | forbidden     |

`isRestrictedEnvironment` = STAGING | PILOT | PRODUCTION.
`isPilotOrProduction` = PILOT | PRODUCTION.

## Consequences

- Startup, validation, and provider factories must resolve environment before enabling adapters.
- Fake/local connectors, notice delivery, and AI providers are **blocked in PILOT/PRODUCTION**.
- Documentation and Mode A tests prove policy tables; they do **not** constitute a real deploy.
- Unknown environment strings fail closed with an explicit error.
