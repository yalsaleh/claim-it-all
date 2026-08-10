# ContractRadar

**Intelligent GCC construction entitlement and contractual notice-detection platform.**

> We continuously monitor construction project records and warn contractors before they miss a contractual entitlement, evidence requirement, or notice deadline.

Phase 1: secure multi-tenant platform + immutable document ingestion (Slice 2B). **Slices 3–7 done (Mode A)** — contract configuration, deadlines, detection, notice drafting, and controlled delivery. **Slice 8 done (Mode A)** — approved connector scopes, fake/local import through the existing ingestion pipeline, deterministic operational alerts/escalations/tasks, and membership-filtered project/portfolio dashboards. **Slice 9 done (Mode A / evidence-based)** — production hardening. **Slice 10 done** — controlled pilot deployment preparation (synthetic). **Slice 11 in progress** — AWS IaC + cloud pilot workflows for synthetic/internal data only; **real cloud apply is NOT claimed** until AWS credentials/account + sharp `PILOT_APPROVED_EXCEPTION` exist. Fake providers blocked in PILOT/PRODUCTION.

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

**Slice 2B** live ingestion remains Mode B (not claimed verified here). **Slices 3–9** are implemented for Mode A (including fake/local connectors, operational dashboards, and Slice 9 production-hardening primitives/docs). Live-ingestion GitHub regression still requires a push after commit.

Not implemented / not claimed done: real AWS pilot apply (Slice 11 scaffolding only until credentials), live commercial mailbox/EDMS providers, entitlement conclusions, autonomous legal-state mutation, electronic signatures, claim valuation, product UI break-glass.

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
| [docs/CONNECTOR_PRIVACY.md](./docs/CONNECTOR_PRIVACY.md) | Connector scope and privacy |
| [docs/OPERATIONS.md](./docs/OPERATIONS.md) | Operational monitoring guide |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Slice 9 deployment hardening (no real deploy claimed) |
| [docs/PILOT_READINESS.md](./docs/PILOT_READINESS.md) | Evidence-based pilot gate |
| [docs/PILOT_DEPLOYMENT.md](./docs/PILOT_DEPLOYMENT.md) | CI vs real cloud synthetic pilot |
| [docs/SLICE11_EVIDENCE.md](./docs/SLICE11_EVIDENCE.md) | Slice 11 honesty / evidence labels |
| [docs/COST_CONTROLS.md](./docs/COST_CONTROLS.md) | Pilot cost guardrails |
| [docs/INCIDENT_RESPONSE.md](./docs/INCIDENT_RESPONSE.md) | Incident + runbook index |

## Operating principles

- Never automatically send contractual notices.
- Never present AI interpretation as final legal advice.
- Every conclusion must link to source evidence.
- Maintain strict tenant and project separation.

## License

Proprietary — all rights reserved unless otherwise stated.
