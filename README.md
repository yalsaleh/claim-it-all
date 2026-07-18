# ContractRadar

**Intelligent GCC construction entitlement and contractual notice-detection platform.**

> We continuously monitor construction project records and warn contractors before they miss a contractual entitlement, evidence requirement, or notice deadline.

ContractRadar is an enterprise SaaS foundation for major contractors, subcontractors, consultants, developers, claims professionals, and construction portfolios across Kuwait, Saudi Arabia, the UAE, Qatar, Bahrain, and Oman.

This repository currently establishes the **product foundation**: architecture, domain model, security model, roadmap, and implementation backlog. Application code will be added deliberately against that foundation — not as a disposable prototype or chatbot demo.

---

## The problem

On GCC construction projects, contractual entitlements are frequently lost not because the contractor had no case, but because:

- Notice deadlines under FIDIC-based or heavily amended contracts were missed.
- Evidence was incomplete, scattered, or never linked to the event.
- Correspondence in Arabic and English was not monitored systematically.
- Project teams discovered claimable events too late.
- Internal “we should draft something” reminders were confused with contractual deadlines.
- Commercial, planning, and site records lived in disconnected systems.

The cost of a missed notice can erase months of legitimate entitlement. ContractRadar exists to make entitlement risk visible early, evidence-backed, and actionable under human control.

---

## Target users

| Role | Primary need |
|------|----------------|
| **Contractor / Subcontractor commercial teams** | Early warning of entitlement events and notice deadlines |
| **Claims / contracts managers** | Clause mapping, evidence packs, draft notices for review |
| **Project managers / site teams** | Structured follow-up questions; capture missing facts |
| **Planning / delay analysts** | Link events to schedule activities and concurrency context |
| **Developers / employers / consultants** (later) | Portfolio visibility with appropriate role boundaries |
| **Enterprise admins** | Tenant security, audit, SSO, client-hosted options |

---

## Core workflows

### 1. Historical project scan (first release)

1. Create a tenant and project.
2. Ingest contracts, amendments, and project records (correspondence, RFIs, instructions, minutes, reports, schedules, payment records, etc.).
3. Extract and preserve structured facts while keeping originals immutable.
4. Detect candidate entitlement events in initial categories.
5. Map events to contractual clauses and obligations.
6. Calculate contractual and recommended internal deadlines with transparent calculation trails.
7. Link supporting evidence; flag missing evidence.
8. Present a review queue for humans — never auto-send notices.

### 2. Human review and notice drafting

1. Reviewer inspects event, evidence, clause references, and deadline math.
2. System may draft a contractual notice for **human approval only**.
3. Reviewer approves, rejects, revises, or requests more information.
4. Outcomes and rationale are audit-logged.
5. Sending a notice is always an explicit human action outside automatic pipelines.

### 3. Live monitoring (later)

Same detection and review loop, fed by continuous ingestion and scheduled deadline checks rather than a one-time historical scan.

### Operating principles (non-negotiable)

- Never automatically send contractual notices.
- Never present AI interpretation as final legal advice.
- Every conclusion must link to source evidence.
- All deadlines must show how they were calculated.
- Every generated draft requires human approval.
- Preserve original documents and extracted data.
- Maintain strict tenant and project separation.
- Do not hardcode one contract form, one country, or one workflow.
- Arabic and English are core requirements, not a future translation layer.
- Clearly distinguish **facts**, **interpretations**, **assumptions**, **missing information**, and **human-approved conclusions**.

---

## Technical architecture (summary)

Monorepo with clear boundaries:

| Layer | Technology | Role |
|-------|------------|------|
| Web application | Next.js (TypeScript) | UI, BFF/API routes, auth, tenancy enforcement |
| Primary database | PostgreSQL + Prisma | Structured domain data, RBAC, audit |
| Object storage | S3-compatible (MinIO local) | Original documents, derivatives, evidence blobs |
| Document / AI workers | Python (FastAPI + workers) | OCR, extraction, bilingual NLP, AI orchestration |
| Jobs / queues | Redis + worker processes | Ingestion, extraction, deadline checks, monitoring |
| AI providers | Pluggable provider layer | Model calls without vendor lock-in |
| Local platform | Docker Compose | Postgres, Redis, MinIO, app services |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full design.

```
apps/web                        Next.js application
services/document-intelligence  Python document + AI workflows
packages/shared                 Shared types and contracts (TS)
packages/contract-rules         Deterministic clause/deadline helpers
infrastructure/                 Docker, later Terraform
docs/                           Architecture, backlog, ADRs, workflows
```

---

## Development principles

1. **Domain first** — model entitlements, evidence, and deadlines before dashboards.
2. **Evidence-linked conclusions** — no orphan AI claims.
3. **Human-in-the-loop** — AI proposes; humans decide.
4. **Precision for dates, money, and clauses** — typed, tested, auditable.
5. **Tenant isolation by design** — every query is tenant-scoped.
6. **Bilingual by design** — Arabic/English content, UI, and search paths.
7. **Small modular services** — clear ownership; no god modules.
8. **Secure defaults** — no secrets in code; no sensitive project text in logs.
9. **Test the dangerous paths** — deadline math, tenancy, authz, ingestion.
10. **Honest UI** — never fake “analysis complete” without real pipelines.

---

## Initial scope (Phase 1)

**In scope**

- Multi-tenant foundation (org → project → membership → roles).
- Document upload and immutable storage.
- Ingestion pipeline skeleton (queue → extract → persist).
- Contract metadata and clause register (manual + assisted extraction).
- Historical scan for five event categories:
  1. Late drawings or approvals
  2. Suspension or restricted site access
  3. Scope changes or additional work
  4. Delayed payment
  5. Unforeseen site conditions
- Event review queue with evidence links and deadline calculation display.
- Draft notice generation requiring human approval (no send automation).
- Full audit trail for review actions.
- Arabic and English document handling at the ingestion layer.

**Out of scope for Phase 1**

- Live mailbox / EDMS connectors
- Auto-send of notices
- Confirmed quantum / “guaranteed claim value”
- Full FIDIC expert system for every amendment pattern
- Client-hosted production packaging (designed for, not shipped)
- Mobile-native apps

---

## Long-term roadmap

See [ROADMAP.md](./ROADMAP.md). High-level phases:

1. **Foundation & historical scan** — tenancy, ingestion, five event types, review loop.
2. **Contract intelligence depth** — richer FIDIC/amended GCC clause models, bilingual correspondence monitoring.
3. **Live monitoring** — continuous feeds, deadline watchers, structured follow-ups.
4. **Commercial & schedule linkage** — activities, concurrency context, provisional entitlement ranges.
5. **Learning & enterprise delivery** — reviewer feedback loops, SSO, client-hosted / private cloud.

---

## Repository status

This repository was initialized as an empty workspace. The current commit surface is the **planning and structural foundation** only. No fake AI analysis, placeholder dashboards, or simulated integrations are presented as working product features.

---

## Getting started (local platform)

> Application packages are not fully scaffolded until Phase 1 implementation begins. Infrastructure compose files are provided so the data plane can be stood up early.

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Start data dependencies (Postgres, Redis, MinIO)
docker compose -f infrastructure/docker/docker-compose.yml up -d

# 3. (Later) Install app deps, migrate, run web + document-intelligence
# See docs/backlog/phase-1.md
```

---

## Documentation index

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design across all major subsystems |
| [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) | Business entities and relationships |
| [ROADMAP.md](./ROADMAP.md) | Product phases |
| [DECISIONS.md](./DECISIONS.md) | Architectural decision log |
| [SECURITY.md](./SECURITY.md) | Enterprise construction-data security |
| [docs/backlog/phase-1.md](./docs/backlog/phase-1.md) | First implementation backlog |
| [docs/workflows/](./docs/workflows/) | Core product workflow notes |

---

## License

Proprietary — all rights reserved unless otherwise stated in a future license file.
