# CI verification modes

ContractRadar supports two verification modes. Ordinary local development **does not require Docker**.

## Mode A — Local lightweight (`pnpm verify:local`)

Runs on a developer Mac without Docker:

- format, lint, typecheck
- TypeScript unit tests (including `@contractradar/contract-rules` deadline engine and `@contractradar/event-detection` detector tests)
- embedded PostgreSQL integration / security tests (tenant isolation, Slice 3 contract revision immutability, Slice 4 deadline workflow)
- Python Ruff, mypy, non-live pytest (parsers + scanner contract tests)
- production web build

This mode **must not** be described as live MinIO/Redis/ClamAV/ARQ verification. It also does **not** replace Mode B after contract-intelligence changes that touch `apps/web` migrations or shared authz — those still trigger Live ingestion regression via path filters.

## Mode B — GitHub Actions live ingestion (`.github/workflows/live-ingestion.yml`)

Authoritative Slice 2B operational verification. Uses GitHub-hosted runners to provision:

- PostgreSQL, Redis (GitHub `services:`)
- MinIO + ClamAV (explicit `docker run` sidecars after image validation)
- document-intelligence API, ARQ worker, outbox dispatcher

Pinned image names live in `scripts/ci/container-images.env`. Job `validate-images` pulls each image independently before live tests. Command: `pnpm test:live:ci` (fails on unexpected skips when `REQUIRE_LIVE_INGESTION_TESTS=true`).

Digest pinning (`image@sha256:…`) is a follow-up once tags have been proven green on GitHub.

### Why MinIO is not a GitHub `services:` container

Official `minio/minio` requires `server /data`. GitHub Actions `services:` cannot set that command, so the container exits immediately and `Initialize containers` fails. Foundation CI and live ingestion both start MinIO via `scripts/ci/start-live-sidecars.sh`.

### MinIO client (`minio/mc`) invocation

`minio/mc` images use `ENTRYPOINT ["mc"]`. Bucket init must use `--entrypoint /bin/sh` (or Compose `entrypoint: ["/bin/sh","-c"]`) so a shell runs. Passing `/bin/sh` as a trailing argument invokes `mc /bin/sh …` and fails.

### Known image corrections (2026-07-19)

| Was (invalid) | Now (Docker Hub verified) |
|---------------|---------------------------|
| `clamav/clamav:1.4.1-41` | `clamav/clamav:1.5-debian13-slim` |
| `minio/mc:RELEASE.2024-11-17T19-35-56Z` | `minio/mc:RELEASE.2024-11-21T17-21-54Z` |

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

Slice 6 adds `@contractradar/notice-drafting` unit tests and PostgreSQL notice workflow integration coverage in Mode A verify.
