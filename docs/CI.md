# CI verification modes

ContractRadar supports two verification modes. Ordinary local development **does not require Docker**.

## Mode A — Local lightweight (`pnpm verify:local`)

Runs on a developer Mac without Docker:

- format, lint, typecheck
- TypeScript unit tests
- embedded PostgreSQL integration / security tests
- Python Ruff, mypy, non-live pytest (parsers + scanner contract tests)
- production web build

This mode **must not** be described as live MinIO/Redis/ClamAV/ARQ verification.

## Mode B — GitHub Actions live ingestion (`.github/workflows/live-ingestion.yml`)

Authoritative Slice 2B operational verification. Uses GitHub-hosted runners to provision:

- PostgreSQL, Redis, MinIO (private bucket), ClamAV
- document-intelligence API, ARQ worker, outbox dispatcher

Command inside the workflow: `pnpm test:live:ci` (`scripts/test-live-ci.sh`), which fails on unexpected skips when `REQUIRE_LIVE_INGESTION_TESTS=true`.

### Manual trigger (no local Docker)

1. Open the GitHub repository → **Actions**
2. Select workflow **Live ingestion**
3. Click **Run workflow**
4. Choose the branch → **Run workflow**

Optional (if `gh` is installed):

```bash
gh workflow run live-ingestion.yml --ref <branch>
```

### Recommended branch protection

Require the **Live ingestion** workflow to pass before merging PRs that change ingestion, storage, workers, migrations, scanner, queue, evidence, authorization, or RLS. This cannot be configured from the repository alone without admin access — set it in GitHub → Settings → Branches.

## Foundation CI (`.github/workflows/ci.yml`)

Static + unit + Postgres/Redis/MinIO-backed integration with `MALWARE_SCANNER=fake_test`. Complements Mode B; does not replace it.
