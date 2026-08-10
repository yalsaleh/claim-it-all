# Migration rehearsal (Slice 9B)

## Mode

**Real historical upgrade** in synthetic CI:

1. `git worktree` checkout of verified Slice 8 commit `0e6ff4e`
2. Install that revision’s dependencies
3. Clean Postgres schema (baseline start only)
4. `prisma migrate deploy` at Slice 8
5. Seed representative Slice 8 data (two tenants, projects, documents, contracts, events, deadlines, notices, dispatch, connectors)
6. Record row counts / IDs
7. Return to current HEAD tooling
8. Apply current migrations **without** `prisma migrate reset`
9. Verify preservation, Slice 9 tables, RLS/FORCE RLS, cross-tenant isolation, runtime vs migration roles

Script: `scripts/db/slice8-upgrade-rehearsal.sh`  
Workflow: `.github/workflows/migration-rehearsal.yml` (`fetch-depth: 0`)  
Report: `artifacts/migration/slice8-to-slice9-report.json`

## Labels

- Not a hold-aside approximation of Slice 9
- Not a production-cloud migration
- Synthetic CI database only
