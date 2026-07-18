# ContractRadar — Architectural Decision Log

Decisions are recorded when they materially affect maintainability, security, or scalability. Format: status, context, decision, consequences.

Statuses: **Proposed** · **Accepted** · **Superseded** · **Rejected**

---

## ADR-001 — Monorepo with web app + Python intelligence service

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** The product needs a strong TypeScript web/domain layer and heavy document/AI processing. A single Node stack for OCR/NLP would fight the ecosystem; a single Python web UI would slow product iteration.

**Decision:** Use a monorepo containing `apps/web` (Next.js/TS) and `services/document-intelligence` (Python), plus shared packages for types and deterministic contract rules.

**Consequences:** Clear ownership boundaries; cross-language contracts must be versioned; local Docker becomes important early. Avoids premature microservice sprawl.

---

## ADR-002 — PostgreSQL + Prisma as system of record

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Entitlements, audit, RBAC, and deadlines need transactional integrity and strong typing.

**Decision:** PostgreSQL is the primary datastore. Prisma migrations are authoritative for schema. Python workers persist via internal APIs or tightly constrained DB access aligned to the same schema.

**Consequences:** Excellent fit for multi-tenant relational data; JSONB for extraction payloads; must enforce `tenant_id` discipline in application code (RLS may be added later).

---

## ADR-003 — S3-compatible object storage for documents

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Construction files are large and must remain immutable and portable across SaaS and client-hosted deployments.

**Decision:** Store originals and derivatives in S3-compatible storage (MinIO locally). Metadata and provenance live in PostgreSQL.

**Consequences:** Portable deployment; pre-signed URL access patterns; need malware-scan hooks and encryption configuration per environment.

---

## ADR-004 — Hybrid rule + AI detection; deterministic deadline math

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** LLMs are useful for bilingual classification and drafting, but unreliable for binding date arithmetic and easy to overtrust legally.

**Decision:** Use AI for assisted extraction, classification proposals, and draft language. Use deterministic, tested code for deadline calculation and obligation-rule evaluation. Persist epistemic status on all inferred fields.

**Consequences:** More engineering on rule models; higher trustworthiness; UI must explain calculations.

---

## ADR-005 — Pluggable AI provider layer

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Enterprise customers differ on approved vendors; air-gapped options may be required later.

**Decision:** Abstract providers behind adapters (OpenAI, Azure OpenAI, Anthropic, local/future). Orchestrator records model + prompt versions. No business logic hardcodes a single SDK.

**Consequences:** Slightly more initial abstraction; enables vendor changes and private models without rewriting pipelines.

---

## ADR-006 — Shared-database multi-tenancy with mandatory tenant keys

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Early stage needs velocity; some later customers may require stronger isolation.

**Decision:** Start with shared PostgreSQL and mandatory `tenant_id` on all tenant-owned rows, enforced in server modules and jobs. Design APIs so schema-per-tenant or DB-per-tenant can be added as a deployment topology later.

**Consequences:** Fastest path to MVP; requires rigorous automated cross-tenant tests; optional Postgres RLS as defense-in-depth in Phase 2+.

---

## ADR-007 — Never auto-send contractual notices

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Incorrect automated notices create legal and commercial risk.

**Decision:** Architecture and domain model support draft → human review only. Dispatch is a human-acknowledged record, not an autonomous side effect of AI.

**Consequences:** Product cannot market “fully automated claims notices”; workflow UX must make approval explicit.

---

## ADR-008 — Background jobs for ingestion and monitoring

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** OCR and model calls exceed request timeouts; live monitoring needs schedules.

**Decision:** Redis-backed queues with dedicated workers. Web requests enqueue work and return job status.

**Consequences:** Need idempotent jobs, retries, dead-letter handling, and observability of queue lag.

---

## ADR-009 — Docker Compose for local development data plane

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Contributors need Postgres, Redis, and S3 parity without cloud accounts.

**Decision:** Provide Compose services for PostgreSQL, Redis, and MinIO from day one; app containers added when apps are scaffolded.

**Consequences:** Low friction local setup; CI can reuse the same services.

---

## ADR-010 — Auth library choice deferred to first implementation sprint

| Field | Detail |
|-------|--------|
| Status | Proposed |
| Date | 2026-07-18 |

**Context:** Auth.js and better-auth (and similar) can both satisfy cookie sessions; enterprise SSO arrives later.

**Decision (pending implementation spike):** Choose a maintained TypeScript auth library during Phase 1 scaffolding based on session security, organization support, and SSO upgrade path. Record the final choice as ADR-010a.

**Consequences:** Avoids locking docs to a library before a short spike; does not block domain modeling.

---

## ADR-011 — Arabic and English as core product requirements

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** GCC projects routinely mix Arabic and English; bolting on translation later breaks search, extraction, and UX (RTL).

**Decision:** Language detection, bilingual fields, and RTL-capable UI are Phase 1 constraints. Domain entities include `text_en` / `text_ar` where user-facing contractual text matters.

**Consequences:** Slightly more schema/UI work early; avoids a rewrite when first Arabic-majority project onboarded.

---

## ADR-012 — Historical scan first, live monitoring second

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Live connectors expand security and reliability scope dramatically.

**Decision:** Phase 1 delivers historical upload + scan using the same event/deadline/review domain that live monitoring will reuse.

**Consequences:** Connector framework is designed as an extension point, not faked; less operational risk at MVP.

---

## ADR-013 — Package manager and JS toolchain

| Field | Detail |
|-------|--------|
| Status | Proposed |
| Date | 2026-07-18 |

**Context:** Monorepo needs a single install story.

**Decision (pending Phase 1 scaffold):** Prefer `pnpm` workspaces + Turborepo (or pnpm only if turbo is unnecessary initially). Finalize when `apps/web` is created.

**Consequences:** Keeps Phase 0 free of unnecessary package installs.

---

## ADR-014 — Queue library split by runtime

| Field | Detail |
|-------|--------|
| Status | Proposed |
| Date | 2026-07-18 |

**Context:** Node and Python both need job processing.

**Options:** (A) BullMQ for Node + separate Python workers on Redis lists/RQ/Celery; (B) one language owns all workers.

**Decision leaning:** Python owns heavy document/AI jobs; Node enqueues and may run light jobs (emails, simple recalcs). Exact Python queue library chosen at service scaffold time (Celery/RQ/arq).

**Consequences:** Document in ADR-014a at implementation; keep Redis as the broker to preserve Compose simplicity.
