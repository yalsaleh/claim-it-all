# Slice 9B evidence honesty notes

## Operational / tested in synthetic CI

- Environment policy fail-closed for fake providers in PILOT/PRODUCTION
- Vulnerability policy gating with owned expiring exceptions (**1 critical + 2 high active** after brace-expansion/js-yaml/nanoid overrides; each active exception has advisory ID, package version, dependency path, classification, exploitability, mitigation, owner, approval, expiry, upgrade target, tracking issue). Former brace-expansion exceptions EXC-2026-003/004 marked `resolved`.
- Downloadable artifacts under `artifacts/**` in GitHub Actions (`if-no-files-found: error`) plus **post-upload** download/extract/schema validation jobs
- **Synthetic CI restore** (Postgres + MinIO): cross-tenant isolation, object byte checksum round-trip, tamper rejection, and **DB object-reference resolution** (`database-object-reference-report.json`)
- **Real historical migration upgrade**: git worktree checkout of verified Slice 8 commit `0e6ff4e` → current HEAD forward migrate (no `prisma migrate reset` on upgrade stage)
- Migration drift detection + runtime/migration role separation
- **Real production container build** for web (`apps/web/Dockerfile`) and DI image: non-root UID 10001, health/readiness, no `.env`/secrets in image (not Kubernetes readiness)
- **Internal synthetic service readiness** in Production readiness: PostgreSQL, Redis, MinIO, ClamAV, DI API, ARQ worker, outbox dispatcher (reuses Live ingestion scripts)
- Explicit test-purge rejection in STAGING/PILOT/PRODUCTION (`test-purge-safety-report.json`, `CFG_TEST_PURGE_ENABLED`)
- License inventory + policy
- `pnpm env:doctor` for local Docker/Postgres absence (**NOT RUN**, not PASS)

## Labels (do not overclaim)

| Claim | Reality |
| --- | --- |
| Synthetic CI restore | Ephemeral GHA Postgres/MinIO only |
| Real historical migration upgrade | True `0e6ff4e` worktree → current |
| Real production container build | Docker build+run on GHA runner |
| Internal synthetic service readiness | Localhost sidecars + workers |
| Cloud deployment | **No** |
| Live customer provider | **No** |
| Real external data / notices | **No** |

## Python warnings

- First-party `datetime.utcnow()` / FastAPI `on_event`: removed (count **0**)
- Third-party botocore: upgraded via `boto3==1.40.2` (botocore ≥ 1.40.2 includes utcnow fix). If any residual third-party warning remains, it is documented as third-party-only and not globally suppressed.

## Node.js Actions runtime warnings (from workflow run pages, not YAML inference)

On commit verification runs that still used `actions/download-artifact@v6`, GitHub run pages showed:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: `actions/download-artifact@v6`

Observed on Migration rehearsal, Backup/restore, Production readiness, and Dependency/security verify jobs. CI and Live ingestion run pages on the same commit showed **no** Node 20 banner (they do not use download-artifact).

Mitigation applied: upgrade post-upload jobs to `actions/download-artifact@v8` and `actions/upload-artifact@v7` (Node 24 runtimes). Re-confirm absence/presence of banners from the final green commit’s run pages after push.

## Documented only / deferred

- Break-glass infrastructure access UI
- MFA provider enforcement (architecture-only)
- Vault / cloud secret manager integration (provider-neutral refs only)
- Live external APM/telemetry backends
- Real provider connectors (fixture connectors only in CI)
- Real cloud restore
- Kubernetes deployment
