# ContractRadar — Architecture

This document describes the production-oriented architecture for ContractRadar. It is the design authority for implementation. Product principles in [README.md](./README.md) take precedence over convenience shortcuts.

---

## 1. Goals and constraints

**Goals**

- Detect entitlement-relevant events from construction project records.
- Calculate notice deadlines transparently from contract rules + event dates.
- Keep humans in control of legal conclusions and outbound notices.
- Support Arabic and English as first-class content languages.
- Scale from single-project historical scans to multi-project live monitoring.
- Support private / client-hosted deployment without rewriting the product.

**Constraints**

- No automatic sending of contractual notices.
- No unsupported legal conclusions in the UI or APIs.
- Strict tenant and project isolation.
- Original documents are immutable; extracted data is versioned.
- AI providers are pluggable; business logic must not depend on one vendor.

---

## 2. System context

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users (RBAC)                            │
│  Commercial · Claims · PM · Planner · Admin · Reviewer          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                    apps/web (Next.js / TS)                       │
│         UI · API routes · Auth · Tenancy · Audit write           │
└───────┬───────────────────┬───────────────────┬─────────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────────────────┐
│  PostgreSQL   │  │ Object Storage │  │ Redis (ARQ / rate limits)│
│  + outbox     │  │ S3 / MinIO     │  │                          │
└───────┬───────┘  └───────▲────────┘  └────────────▲─────────────┘
        │                  │                        │
        │ outbox           │         ┌──────────────┴─────────────┐
        └──────────────────┼─────────┤ document-intelligence      │
                           └─────────┤ API · ARQ worker · dispatch│
                                     │ ClamAV · extract           │
                                     └──────────────┬─────────────┘
                                                    │
                                     ┌──────────────▼─────────────┐
                                     │ AI Provider Adapter Layer  │
                                     │ OpenAI / Azure / Anthropic │
                                     │ / local / future vendors   │
                                     └────────────────────────────┘
```

Ingestion control plane (Slice 2B): web accept transaction writes `OutboxEvent` → dispatcher enqueues ARQ → worker scans/promotes/extracts. See ADR-025.

Verification: Mode A `pnpm verify:local` (no Docker) for unit/embedded checks; Mode B GitHub Actions `live-ingestion.yml` for real MinIO/Redis/ClamAV/ARQ.

---

## 3. Frontend architecture

**Stack:** Next.js (App Router) + TypeScript + accessible component patterns.

**Responsibilities**

- Authenticated project workspaces (tenant-scoped).
- Document library with original-file access and extraction status.
- Event review queue (priority by deadline urgency).
- Event detail: facts vs interpretations vs assumptions vs missing info.
- Deadline calculation panel (inputs, clause basis, contractual vs recommended).
- Evidence linker and missing-evidence checklist.
- Notice draft editor with approval workflow states.
- Audit history views for compliance reviewers.
- Bilingual UI chrome (en / ar) with RTL support for Arabic.

**Structure (target)**

```
apps/web/src/
  app/                 # App Router routes
  components/          # UI primitives and domain components
  server/              # Server actions, loaders, auth helpers
  lib/                 # Shared client/server utilities
  styles/              # Design tokens, RTL-aware styles
```

**UI principles**

- Professional, accessible, construction-operations tone — not a chatbot shell.
- Every AI-derived field labeled by epistemic status (fact / interpretation / assumption / missing / human-approved).
- No “analysis complete” states without real pipeline confirmation.
- Prefer server-driven data for tenancy-sensitive views.

---

## 4. Backend architecture

ContractRadar uses a **modular monolith for the web/API domain** plus a **separate Python document-intelligence service** for CPU/GPU-heavy and AI-heavy work.

### 4.1 Web / domain API (`apps/web`)

- Next.js Route Handlers / server modules for domain APIs.
- Prisma for persistence.
- Enforces authentication, authorization, and tenant scoping on every request.
- Enqueues jobs; does not run long OCR/LLM pipelines in the request path.
- Owns notice workflow state transitions and audit writes for human actions.

### 4.2 Document intelligence (`services/document-intelligence`)

- FastAPI HTTP API for internal service calls + health.
- Async workers consuming Redis-backed queues.
- Pipelines: ingest → classify → extract → normalize → emit domain events.
- AI orchestration via provider adapters.
- Returns structured results with provenance (document id, page/span, confidence, language).

### 4.3 Shared contracts

- `packages/shared`: TypeScript types for API payloads and domain enums.
- OpenAPI / JSON Schema exported from Python for cross-language validation where needed.
- `packages/contract-rules`: validation/normalization (Slice 3) plus pure Luxon-based `calculateDeadline` against serializable approved-rule + calendar inputs (Slice 4). No DB/AI/authz inside the package.

---

## 5. Database

**Engine:** PostgreSQL 16+.

**Access layer:** Prisma (TypeScript) as the system of record for the web domain. Python workers write through controlled APIs or a narrow set of well-defined tables via a shared migration discipline (Prisma migrations are authoritative for schema).

**Design rules**

- Every tenant-owned row includes `tenant_id` (UUID).
- Project-scoped entities include `project_id`.
- Soft-delete only where legally/audit-required; prefer append-only for audit and evidence links.
- Monetary amounts stored as integers in minor units + ISO currency code, or `NUMERIC` with explicit scale — never floating point.
- Dates stored as `date` or `timestamptz` with explicit timezone policy per field.
- JSONB allowed for extraction payloads; indexed paths for query-critical fields promoted to columns.
- Full-text / trigram indexes planned for bilingual search (Phase 2+).

**Core table groups**

- Identity & tenancy: `tenants`, `users`, `memberships`, `roles`, `permissions`
- Projects: `projects`, `project_members`, `project_settings`
- Documents: `documents`, `document_versions`, `document_extractions`
- Contracts: `contracts`, `contract_clauses`, `obligation_rules`, `amendments`
- Events: `entitlement_events`, `event_classifications`, `event_clause_links`
- Deadlines: `deadlines`, `deadline_calculations`
- Evidence: `evidence_links`, `evidence_requirements`, `missing_evidence_items`
- Notices: `notice_drafts`, `notice_reviews`, `notice_dispatch_records` (manual send log only)
- Follow-ups: `follow_up_questions`, `follow_up_answers`
- Audit: `audit_logs`
- Jobs: `ingestion_jobs`, `pipeline_runs`

See [DOMAIN_MODEL.md](./DOMAIN_MODEL.md).

---

## 6. File storage

**Interface:** S3-compatible object storage.

| Environment | Implementation |
|-------------|----------------|
| Local | MinIO |
| Cloud SaaS | Amazon S3 (or equivalent) |
| Client-hosted | Customer S3-compatible store |

**Object key convention**

```
tenants/{tenant_id}/projects/{project_id}/documents/{document_id}/original/{filename}
tenants/{tenant_id}/projects/{project_id}/documents/{document_id}/derivatives/{...}
```

**Rules**

- Originals are write-once; replacements create new `document_versions`.
- Server-side encryption at rest (SSE-S3 or SSE-KMS depending on deployment).
- Pre-signed URLs for download; no public buckets.
- Virus/malware scanning hook before extraction (Phase 1: interface + optional local ClamAV; enforce in hardened envs).
- Metadata in Postgres; blobs only in object storage.

---

## 7. Document ingestion

```
Upload (web) → Document row (PENDING)
     → Object storage put
     → Enqueue ingest job
     → Worker: validate → hash → classify language/type
     → OCR / text extract (PDF, DOCX, images, email)
     → Normalize (dates, parties, refs) with provenance spans
     → Persist DocumentExtraction (versioned)
     → Emit candidates to event-detection pipeline
     → Status: READY | FAILED (retryable with reason codes)
```

**Document types (initial)**

Contracts, amendments, correspondence, RFIs, engineer instructions, meeting minutes, daily reports, schedules, variation registers, payment records, site records, drawings metadata, cost evidence.

**Bilingual handling**

- Detect language per document and per segment where possible.
- Preserve Arabic text without forced transliteration.
- Store `language` and `script_direction` metadata.
- Mixed-language documents supported via segment-level language tags.

---

## 8. AI orchestration

**Design:** Provider-agnostic orchestration layer in Python.

```
Orchestrator
  ├── Prompt templates (versioned)
  ├── Tool / schema validators (structured outputs)
  ├── Provider adapters (OpenAI, Azure OpenAI, Anthropic, local)
  ├── Policy gates (PII redaction options, max tokens, tenant allowlists)
  ├── Run logging (prompt version, model, latency, token usage — no raw secrets)
  └── Fallback / retry policies
```

**Rules**

- Structured outputs validated against schemas before persistence.
- Every model output stored with `epistemic_status = interpretation` until human approval.
- Prompt and model versions recorded for reproducibility.
- Tenant data never used for provider training (contractual + technical controls).
- Deterministic steps (deadline math, clause id joins) are **not** delegated to LLMs.

---

## 9. Contract analysis

Slice 3 establishes the human-verified contract configuration chain: ContractPackage → documents/amendments → precedence → source-linked clauses → terms/parties/roles → obligations → notice-rule candidates → configuration revisions. Assisted extraction produces **suggestions only** (`MACHINE_SUGGESTED` / `PENDING_REVIEW`); nothing becomes `APPROVED` without human review (ADR-027–036, DOMAIN_MODEL §6).

**Goal:** Represent the project’s governing contract as machine-usable obligations without hardcoding a single FIDIC book as the only form.

**Components**

1. **Contract package** — base form (e.g., FIDIC Red/Yellow/Silver family or bespoke), governing law, language, currency, calendar rules.
2. **Clause register** — clause number, title, text (ar/en), obligation type, notice period, condition precedents; source text immutable, normalized/corrected text versioned.
3. **Amendment overlay** — amendments supersede or modify base clauses with effective dates; effects are reviewable, never silently inferred.
4. **Obligation / notice-rule candidates** — structured rules derived from clauses (notice within N days of awareness, particular forms, copy-to parties); vague timing stays non-numeric.
5. **Assisted extraction** — deterministic first; optional AI proposes structures; humans confirm before production use.

Uploads remain immutable (Slice 2). Clause extraction must not invent clause numbers or fabricate wording. FIDIC form profiles may guide candidate detection but never substitute for uploaded evidence.

AI providers are optional, adapter-based, and disabled by default (`CONTRACT_AI_PROVIDER`). Fake/test providers are rejected in production-like environments (ADR-034).

Threat model: [docs/threat-models/contract-intelligence.md](./docs/threat-models/contract-intelligence.md).

Phase 1 Slice 4 delivers human-confirmed project events and deterministic deadline calculation against approved rule snapshots. AI event detection from correspondence remains a later slice.

---

## 10. Event detection

**Initial categories**

1. Late drawings or approvals  
2. Suspension or restricted site access  
3. Scope changes or additional work  
4. Delayed payment  
5. Unforeseen site conditions  

**Pipeline**

1. Feature extraction from documents (dates, actors, directives, payment refs, access language).
2. Rule + model hybrid classifiers emit `EntitlementEvent` candidates.
3. Deduplicate / merge near-duplicates across documents.
4. Attach provisional clause links from obligation rules.
5. Create evidence requirements checklist per category.
6. Enter review queue with urgency scoring.

**Future categories** (architecture must not block): acceleration, out-of-sequence work, verbal instructions, late handover, utility conflicts, design revisions, material approval delays, consultant non-response, exceptional weather, concurrent delay.

**Epistemic labeling**

| Status | Meaning |
|--------|---------|
| `fact` | Directly extracted from source with span |
| `interpretation` | AI or rule inference |
| `assumption` | Explicit system or user assumption |
| `missing` | Required information not found |
| `human_approved` | Confirmed by authorized reviewer |

---

## 11. Deadline calculation

Deadlines are computed by **deterministic services**, not free-form LLM arithmetic.

**Slice 4:** `@contractradar/contract-rules` provides pure Luxon-based `calculateDeadline` against approved rule snapshots + calendar revisions (ADR-037–047). Still no DB/AI/authz inside the package. Project events are human-confirmed only — no AI event detection.

**Inputs**

- Event date / awareness date (with source).
- Applicable obligation rule (notice period, calendar type).
- Project calendar (working days, weekends, public holidays by jurisdiction — pluggable).
- Contractual vs internal policy offsets.

**Outputs**

- `contractual_deadline` — binding calculation from confirmed rules.
- `recommended_internal_deadline` — earlier operational target (configurable).
- `DeadlineCalculation` audit record: formula, inputs, timezone, calendar id, rule version.

**Display rule:** UI must always show the calculation trail. If inputs are missing, status is `incomplete` — never invent a date.

---

## 12. Evidence linking

- `EvidenceLink` joins an event (or notice) to a document span / page / file.
- `EvidenceRequirement` defines what the category typically needs (e.g., instruction letter, photo, programme extract).
- `MissingEvidenceItem` tracks gaps until satisfied or waived (waiver is audited).
- Links store provenance: document_id, version_id, page, char offsets or bounding boxes when available.

---

## 13. Audit logging

**Append-only `audit_logs`**

Minimum fields: `id`, `tenant_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `before`, `after`, `reason`, `request_id`, `created_at`, `ip_hash` (optional).

**Must audit**

- Auth events (login failures without leaking credentials)
- Document upload / delete requests
- Event status changes
- Notice draft create / edit / approve / reject / revise
- Manual send acknowledgements
- Permission and membership changes
- Export / download of sensitive packs

Audit logs are tenant-scoped and immutable via application controls (no update/delete APIs).

---

## 14. Authentication

**Phase 1:** Email/password or magic-link style session auth via a maintained auth library (e.g. Auth.js / better-auth — final choice recorded in DECISIONS.md at implementation time), secured cookies, CSRF protection.

**Later:** SAML/OIDC SSO for enterprise tenants, SCIM provisioning, optional MFA enforcement per tenant policy.

**Sessions:** HTTP-only, Secure, SameSite cookies; short-lived access with rotation; server-side session invalidation.

---

## 15. Authorization

**Model:** RBAC with project-scoped roles + tenant admin roles.

Example roles (initial):

| Role | Capabilities |
|------|----------------|
| `tenant_admin` | Manage users, billing hooks, tenant settings |
| `project_admin` | Manage project membership, settings |
| `contracts_manager` | Confirm clauses, approve notice drafts |
| `commercial_reviewer` | Review events, edit drafts |
| `project_member` | Upload docs, answer follow-ups, view assigned projects |
| `auditor_readonly` | Read audit + evidence packs; no mutations |
| `system_worker` | Internal service principal for pipelines |

Authorization checks occur in server modules — never only in the UI. Every query filters by `tenant_id` and authorized `project_id`s.

---

## 16. Multi-tenancy

**Strategy:** Shared database, **strict row-level tenant isolation** via mandatory `tenant_id` on all tenant-owned tables. Application middleware injects tenant context from the authenticated session.

**Hard rules**

- No cross-tenant queries in application code paths.
- Object storage keys prefixed by tenant.
- Background jobs carry `tenant_id` and re-verify on execution.
- Future option: schema-per-tenant or database-per-tenant for regulated clients without changing domain APIs (deployment topology variation).

**Project separation:** Users only see projects they are members of (unless tenant_admin with explicit elevation that is audited).

---

## 17. Security

See [SECURITY.md](./SECURITY.md) for the full control set. Architecture-level controls:

- Secrets only via environment / secret manager.
- Structured logging with redaction of document text and PII by default.
- Internal service auth between web and document-intelligence (mTLS or shared HMAC/token over private network).
- Dependency scanning and CI lint/test gates.
- Encryption in transit (TLS) and at rest (DB + object storage).
- Least-privilege IAM for cloud roles.

---

## 18. Integrations

**Phase 1:** Manual upload only.

**Designed extension points (do not fake):**

- Email ingest (mailbox connectors)
- EDMS / DMS (SharePoint, Aconex, Asite, etc.)
- Scheduling tools (P6/MS Project exports)
- Cost systems (payment certificates)
- e-signature / outbound email for **human-triggered** notice dispatch logging

Each connector implements: auth, incremental sync, document normalization, tenant mapping, and failure isolation.

---

## 19. Deployment

### Local

Docker Compose: PostgreSQL, Redis, MinIO, (later) web + document-intelligence.

### SaaS

- Containerized services on Kubernetes or equivalent.
- Managed Postgres + Redis + S3.
- Horizontal workers for ingestion/AI.
- Blue/green or rolling deploys; migrations gated.

### Client-hosted / private

- Same containers; customer-provided Postgres/S3/Redis or bundled charts.
- Air-gapped AI option via local model adapter (later).
- Configuration through env + secrets — no code forks required for isolation mode.

---

## 20. Observability

- Structured JSON logs with `request_id`, `tenant_id`, `project_id`, `job_id`.
- Metrics: job success/failure, queue lag, extraction latency, review SLA aging.
- Tracing across web → queue → worker.
- Never log full contract clauses or notice bodies at info level in production.

---

## 21. Testing strategy

| Layer | Focus |
|-------|--------|
| Unit | Deadline math, obligation rule evaluation, RBAC helpers |
| Integration | Ingestion job → DB + storage; API tenancy isolation |
| Contract | OpenAPI / shared schema compatibility |
| E2E (later) | Review queue happy path with fixtures (non-secret sample docs) |
| Security | Cross-tenant access attempts must fail |

---

## 22. Explicit non-goals for architecture

- Replacing lawyers or claims consultants.
- Autonomous notice dispatch.
- Single-country hardcoding.
- Presenting model guesses as confirmed entitlement values.
