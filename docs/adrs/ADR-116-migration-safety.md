# ADR-116 — Migration safety

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Prisma migrations can lock tables, drop data, or collapse security assumptions. Restricted
environments require migrate/runtime role separation (ADR-104). Seed and purge helpers
safe for tests are dangerous in PILOT/PRODUCTION.

## Decision

1. Prefer expand/contract migrations; avoid destructive one-shots without rehearsal
2. CI workflow `migration-rehearsal` applies migrations to an ephemeral DB, runs
   integrity checks, and applies again from an older head when feasible
3. Runtime DB role must lack DDL; migrate role used only in gated jobs/pipelines
4. After schema changes, re-verify RLS policies and FORCE RLS on touched tables
5. Seed/purge GUCs and test-only helpers are forbidden in PILOT/PRODUCTION (ADR-103)
6. Pilot procedure: take backup (ADR-113) before migrate; confirm restore path known
7. Migration jobs fail closed on validation errors; no partial silent DDL

## Consequences

- Schema changes stay evidence-based
- No production migrate is claimed in Slice 9 — rehearsal is CI-only
- Cross-links: [DEPLOYMENT.md](../DEPLOYMENT.md), workflow `migration-rehearsal` in [CI.md](../CI.md)
## Alternatives considered

- Runtime role with DDL for convenience — rejected in restricted envs.
- Expand-only forever without rehearsal — rejected; CI must prove forward apply.
- Auto-migrate on application boot in PILOT/PRODUCTION — rejected; gated jobs only.

## Related

- ADR-104 (role separation validation)
- Workflow `migration-rehearsal` in [CI.md](../CI.md)
