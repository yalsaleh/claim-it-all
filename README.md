# ContractRadar

**Intelligent GCC construction entitlement and contractual notice-detection platform.**

> We continuously monitor construction project records and warn contractors before they miss a contractual entitlement, evidence requirement, or notice deadline.

Phase 1 through **Slice 2B**: secure multi-tenant platform + immutable document ingestion. Contract clause extraction and entitlement detection are not implemented yet.

---

## Development modes (Docker not required locally)

| Mode | How | Proves |
|------|-----|--------|
| **A — Local lightweight** | `pnpm verify:local` | Static checks, unit tests, embedded Postgres, Python non-live tests, build |
| **B — Live ingestion** | GitHub Actions **Live ingestion** workflow | Real Postgres, Redis, MinIO, ClamAV, ARQ, outbox, full upload→download path |

Ordinary local development does **not** require Docker Desktop, OrbStack, or Colima. Live operational verification runs on GitHub-hosted runners.

Details: [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) · [docs/CI.md](./docs/CI.md)

```bash
npx pnpm@9.15.0 install --frozen-lockfile
cp .env.example .env && cp apps/web/.env.example apps/web/.env
pnpm verify:local          # Mode A — no Docker
pnpm dev:web               # UI development
```

Trigger Mode B: GitHub → **Actions** → **Live ingestion** → **Run workflow**.

---

## Current status

Implemented: auth/tenancy/RLS, document upload custody, transactional outbox, ClamAV-ready worker, scanner safety (`fake_test` refused outside tests), readiness, reconcile command, Mode A local verify, Mode B CI workflow.

**Slice 2B is ready for CI verification.** It is **not** fully operationally verified until the Live ingestion workflow completes successfully on the target branch.

Not implemented: contract packages/clauses, entitlement events, deadlines, notice drafts.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design |
| [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) | Business entities |
| [ROADMAP.md](./ROADMAP.md) | Product phases |
| [DECISIONS.md](./DECISIONS.md) | ADR index |
| [SECURITY.md](./SECURITY.md) | Security baseline |
| [docs/LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) | Mode A / Mode B |
| [docs/CI.md](./docs/CI.md) | CI workflows |
| [docs/backlog/phase-1.md](./docs/backlog/phase-1.md) | Phase 1 backlog |

## Operating principles

- Never automatically send contractual notices.
- Never present AI interpretation as final legal advice.
- Every conclusion must link to source evidence.
- Maintain strict tenant and project separation.

## License

Proprietary — all rights reserved unless otherwise stated.
