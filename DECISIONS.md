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

## ADR-010 — Authentication with Better Auth

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |
| Details | [docs/adrs/ADR-010-authentication.md](./docs/adrs/ADR-010-authentication.md) |

**Context:** Slice 1 required a real credential/session foundation with Prisma, secure cookies, and an SSO upgrade path — without trusting headers/query/localStorage.

**Decision:** Use **Better Auth** for authentication (email/password + Prisma adapter + DB sessions). Keep ContractRadar `Tenant` / membership models authoritative; do not use Better Auth organizations for tenancy. Active tenant is an httpOnly cookie validated against `TenantMembership`.

**Consequences:** Hashed passwords and revocable sessions out of the box; tenancy/RBAC remain custom and testable; Auth.js remains a viable future alternative only if Better Auth stalls on enterprise IdP needs.

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

---

## ADR-015 — Capability-based RBAC over scattered role checks

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

**Context:** Role-name comparisons scattered through UI/API code become inconsistent and hard to test.

**Decision:** Map tenant/project roles to explicit capabilities in `@contractradar/authz`. Server modules check capabilities (`project.create`, `project.update`, …). Role assignment authority is ranked so users cannot grant higher privilege than they hold. Archived projects drop mutating capabilities.

**Consequences:** Centralized permission tests; UI may hide actions but never authorizes them.

---

## ADR-016 — PostgreSQL RLS

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |
| Details | [docs/adrs/ADR-016-postgresql-rls.md](./docs/adrs/ADR-016-postgresql-rls.md) |

**Decision:** FORCE RLS on tenant-owned business tables with transaction-local `app.current_tenant_id` / `app.current_user_id` / `app.bypass_rls`. Auth tables excluded.

---

## ADR-017 — Audit immutability

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |
| Details | [docs/adrs/ADR-017-audit-immutability.md](./docs/adrs/ADR-017-audit-immutability.md) |

**Decision:** DB triggers block UPDATE/DELETE on `audit_log` except controlled purge with dual GUCs.

---

## ADR-018 — Tenant context cookie

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |
| Details | [docs/adrs/ADR-018-tenant-context-propagation.md](./docs/adrs/ADR-018-tenant-context-propagation.md) |

**Decision:** Signed httpOnly active-tenant cookie is a selector only; membership revalidated every request.

---

## ADR-019 — Auth rate limiting

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |
| Details | [docs/adrs/ADR-019-auth-rate-limiting.md](./docs/adrs/ADR-019-auth-rate-limiting.md) |

**Decision:** Redis-backed login rate limit; fail closed in production when Redis is down.

---

## ADR-020 — Object storage key layout

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-020-object-storage-keys.md](./docs/adrs/ADR-020-object-storage-keys.md) |

**Decision:** Private bucket with `quarantine` / `originals` / `derived` prefixes under tenant/project paths.

---

## ADR-021 — Upload architecture

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-021-upload-architecture.md](./docs/adrs/ADR-021-upload-architecture.md) |

**Decision:** Presigned PUT into quarantine; server verifies HEAD/checksum/magic on complete.

---

## ADR-022 — ARQ workers

| Field | Detail |
|-------|--------|
| Status | Accepted (updated Slice 2B) |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-022-queue-arq.md](./docs/adrs/ADR-022-queue-arq.md) |

**Decision:** ARQ for document jobs; primary enqueue via transactional outbox.

---

## ADR-023 — Malware scanning boundary

| Field | Detail |
|-------|--------|
| Status | Accepted (updated Slice 2B) |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-023-malware-boundary.md](./docs/adrs/ADR-023-malware-boundary.md) |

**Decision:** Modes `clamav` / `fake_test` / `disabled_reject_all`; fake refused outside tests.

---

## ADR-024 — Evidence and duplicates

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-024-evidence-and-duplicates.md](./docs/adrs/ADR-024-evidence-and-duplicates.md) |

**Decision:** Evidence segments + tenant-scoped checksum duplicate detection.

---

## ADR-025 — Transactional outbox

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-025-transactional-outbox.md](./docs/adrs/ADR-025-transactional-outbox.md) |

**Decision:** At-least-once delivery via Postgres outbox + dispatcher → ARQ; idempotent consumers.

---

## ADR-026 — Service-to-service auth

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-19 |
| Details | [docs/adrs/ADR-026-service-to-service-auth.md](./docs/adrs/ADR-026-service-to-service-auth.md) |

**Decision:** Internal token + HMAC timestamp for HTTP DI routes; prefer outbox/ARQ without browser sessions.

---

## Slice 3 — Contract intelligence (ADR-027–036)

| ADR | Title | Decision (brief) |
|-----|-------|------------------|
| [ADR-027](./docs/adrs/ADR-027-contract-package-model.md) | Contract package model | `ContractPackage` + typed `ContractDocument` container; statuses through human-approved configuration |
| [ADR-028](./docs/adrs/ADR-028-clause-source-vs-normalized-text.md) | Clause source vs normalized text | Immutable `sourceText`; corrections via `ClauseTextRevision` |
| [ADR-029](./docs/adrs/ADR-029-amendment-and-precedence.md) | Amendment and precedence | Document relationships + ranked, reviewable `ContractPrecedenceRule` |
| [ADR-030](./docs/adrs/ADR-030-obligation-model.md) | Obligation model | Structured `ContractObligation` (+ triggers/recipients/evidence); time-bar flags are candidates |
| [ADR-031](./docs/adrs/ADR-031-notice-rule-structured-representation.md) | Notice rule structure | Structured `NoticeRule`; default `UNCERTAIN` time-bar classification |
| [ADR-032](./docs/adrs/ADR-032-contract-configuration-revisions.md) | Configuration revisions | Versioned snapshots; approved rows immutable; one active approved pointer |
| [ADR-033](./docs/adrs/ADR-033-human-review-and-approval.md) | Human review and approval | `ReviewDecision` audit; no auto-approve of suggestions or rules |
| [ADR-034](./docs/adrs/ADR-034-ai-assisted-extraction-boundary.md) | AI extraction boundary | Provider-neutral adapters; fake provider test-only; schema-validated suggestions; smallest evidence segments |
| [ADR-035](./docs/adrs/ADR-035-bilingual-contract-handling.md) | Bilingual handling | Language fields + `BILINGUAL_CONFLICT` issues; no silent language preference |
| [ADR-036](./docs/adrs/ADR-036-contract-rules-package-boundary.md) | Contract-rules package boundary | Slice 3 validation; Slice 4 adds pure deadline calc (see follow-up) |

---

## Slice 4 — Deterministic deadlines (ADR-037–047)

| ADR | Title | Decision (brief) |
|-----|-------|------------------|
| [ADR-037](./docs/adrs/ADR-037-approved-notice-rule-snapshot.md) | Approved rule snapshots | Immutable snapshots on configuration approval; only snapshots execute |
| [ADR-038](./docs/adrs/ADR-038-project-event-factual-model.md) | Project events | Manual/human-confirmed facts; no AI detection |
| [ADR-039](./docs/adrs/ADR-039-event-date-assertions.md) | Event dates | Typed, verified, precision-gated dates |
| [ADR-040](./docs/adrs/ADR-040-rule-applicability-assessment.md) | Rule applicability | Human confirmation required; candidates are not conclusions |
| [ADR-041](./docs/adrs/ADR-041-datetime-library-luxon.md) | Date/time library | Luxon in `contract-rules` |
| [ADR-042](./docs/adrs/ADR-042-deadline-calculation-trace.md) | Calculation trace | Machine-readable ordered steps |
| [ADR-043](./docs/adrs/ADR-043-project-calendar-revision.md) | Project calendars | Immutable approved revisions; no hardcoded GCC calendars |
| [ADR-044](./docs/adrs/ADR-044-verified-calculation-immutability.md) | Verified immutability | Verified calculations immutable |
| [ADR-045](./docs/adrs/ADR-045-recalculation-supersession.md) | Recalculation | New result + supersession; mandatory reason |
| [ADR-046](./docs/adrs/ADR-046-internal-warning-policy.md) | Internal warnings | Separate from contractual deadlines; no send |
| [ADR-047](./docs/adrs/ADR-047-deadline-status-updater.md) | Status updater | Idempotent status only; no messaging |
