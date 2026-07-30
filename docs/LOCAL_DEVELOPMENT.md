# Local Development Guide

Ordinary local development **does not require Docker**, Docker Desktop, OrbStack, or Colima.

## Two supported modes

| Mode | Command / place | Requires Docker on your Mac? |
|------|-----------------|------------------------------|
| **A — Lightweight local** | `pnpm verify:local` | **No** |
| **B — Live ingestion** | GitHub Actions workflow `live-ingestion.yml` | **No** (runs on GitHub runners) |

Optional Compose (`pnpm data-plane:up`) exists for advanced operators who already have Docker. It is **not** required and is not the authoritative live verification path.

See also [docs/CI.md](./CI.md).

---

## Mode A — Local lightweight development

Supports:

- Next.js app development (`pnpm dev:web`)
- TypeScript unit tests (including `@contractradar/contract-rules`)
- Embedded PostgreSQL integration / security tests (including Slice 3 contract isolation)
- Python parser and worker **unit** tests (`pytest -k "not live"`)
- Prisma validate/generate
- Static checks + production build
- Deterministic DI tests with `MALWARE_SCANNER=fake_test` (test-only)

Slice 4 local work covers human-confirmed project events, approved calendars, and deterministic deadline calculation via `packages/contract-rules`. Slice 5 detection work uses pure detectors in `packages/event-detection` and **fake/fixture AI only in tests** — live commercial LLM detection is not required for Mode A and is not claimed verified locally.

Slice 8 local work uses **fake/local connector providers only** (`CONNECTOR_PROVIDER=fake` in tests). Fake providers are rejected outside test/dev. Imports create `SourceDocument`/`DocumentVersion` and outbox jobs through the existing ingestion path; they do not auto-confirm events or send notices. See [CONNECTOR_PRIVACY.md](./CONNECTOR_PRIVACY.md) and [OPERATIONS.md](./OPERATIONS.md).

Slice 9 local/operator commands (Mode A — no real deploy):

```bash
pnpm production:validate   # redacted config policy report (ADR-104)
pnpm integrity:check       # post-migrate / post-restore integrity smoke
# Backup scripts (CI/MinIO evidence path; see docs/BACKUP.md)
pnpm backup:run            # when wired; or scripts under scripts/backup/
```

Fake providers remain forbidden when validating as `PILOT` or `PRODUCTION`. Break-glass is not a local UI feature. See [ENVIRONMENT.md](./ENVIRONMENT.md), [PRODUCTION_VALIDATION.md](./PRODUCTION_VALIDATION.md), [PILOT_READINESS.md](./PILOT_READINESS.md).

### Install (no Docker)

```bash
npx pnpm@9.15.0 install --frozen-lockfile
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp services/document-intelligence/.env.example services/document-intelligence/.env
python3 -m venv services/document-intelligence/.venv
services/document-intelligence/.venv/bin/pip install -e "services/document-intelligence[dev]"
```

### Verify locally

```bash
pnpm verify:local
```

This prints explicitly that live MinIO/Redis/ClamAV/ARQ were **not** executed.

### Day-to-day web UI

```bash
pnpm db:generate
# Embedded integration already covers DB; for a persistent local DB you may use any Postgres URL.
pnpm dev:web
```

Seed users (when seeding a DB): `owner@demo-contractor.example` / password from `SEED_OWNER_PASSWORD` or printed once.

### Scanner modes (local)

| `MALWARE_SCANNER` | Allowed |
|-------------------|---------|
| `fake_test` | Only `NODE_ENV=test` / `APP_ENV=test` |
| `clamav` | When a real clamd is available (not required locally) |
| `disabled_reject_all` | Never returns CLEAN |

---

## Mode B — GitHub Actions live data plane

Authoritative Slice 2B operational verification: real PostgreSQL, Redis, MinIO, ClamAV, DI API, ARQ worker, outbox dispatcher, and `pnpm test:live:ci`.

### Trigger without local Docker

1. Push your branch to GitHub (or open a PR that touches ingestion paths)
2. Or: **Actions → Live ingestion → Run workflow → select branch → Run**

Optional CLI: `gh workflow run live-ingestion.yml --ref <branch>`

### What live CI proves

Browser/API upload initiation → presigned MinIO PUT → completion → outbox → dispatcher → ARQ → ClamAV → promote → extract → evidence → signed download (plus infected / invalid / cross-tenant cases).

Until this workflow is green on the target branch, **do not** claim Slice 2B is fully operationally verified.

---

## Ports (only if you optionally run Compose)

| Service | Port |
|---------|------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO | 9000 / 9001 |
| ClamAV | 3310 |
| Document-intelligence | 8000 |
| Next.js | 3000 |

Storage: private bucket `contractradar-documents` with `quarantine` / `originals` / `derived` prefixes (ADR-020).

---

## Recommended branch protection

Require **Live ingestion** to pass before merging changes to ingestion, storage, workers, migrations, scanner, queue, evidence, authz, or RLS. Configure in GitHub branch settings (not automatic from this repo).

Slice 6 adds `@contractradar/notice-drafting` unit tests and PostgreSQL notice workflow integration coverage in Mode A verify.
