# Phase 1 Backlog — Historical Scan MVP

Organized for implementation order. Items are intentionally concrete. Do **not** mark UI as “AI analysis complete” until the underlying pipeline exists.

Legend: `P0` blocker · `P1` required for MVP · `P2` strong follow-on within Phase 1 if time

---

## Epic A — Repository & toolchain bootstrap

| ID | Priority | Item | Acceptance criteria | Status |
|----|----------|------|---------------------|--------|
| A1 | P0 | Scaffold `apps/web` with Next.js + TypeScript | App starts locally; ESLint + TypeScript strict; no dummy dashboards pretending analysis works | Done (Slice 1) |
| A2 | P0 | Scaffold `services/document-intelligence` with FastAPI | Health endpoint; pyproject/requirements pinned; pytest wired | Done (Slice 1) |
| A3 | P0 | pnpm workspace (or chosen tool) + root scripts | `dev`, `lint`, `test`, `typecheck` documented in README | Done (Slice 1) |
| A4 | P0 | Env validation modules (web + Python) | Missing/invalid env fails fast with clear errors | Done (Slice 1) |
| A5 | P1 | CI workflow (lint, typecheck, unit tests) | GitHub Actions runs on PR | Done (Slice 1) |
| A6 | P1 | Prisma init + first migration skeleton | `Tenant`, `User`, memberships, `Project` tables exist | Done (Slice 1) |

---

## Epic B — Identity, tenancy, RBAC

| ID | Priority | Item | Acceptance criteria | Status |
|----|----------|------|---------------------|--------|
| B1 | P0 | Auth sessions (library per ADR-010 spike) | Sign-up/sign-in/sign-out; secure cookies | Done — Better Auth (ADR-010) |
| B2 | P0 | Tenant + project creation | User can create tenant and project; data tagged with `tenant_id` | Partial — project create done; tenant admin UI deferred |
| B3 | P0 | Memberships & roles | Capability-mapped tenant/project role enums | Done (Slice 1) |
| B4 | P0 | Server-side authz helpers | Unauthorized cross-project/cross-tenant requests return 401/403 | Done (Slice 1) |
| B5 | P1 | Cross-tenant isolation tests | Automated tests prove denial | Done (Slice 1B — RLS + adversarial suite, 0 skips) |
| B6 | P2 | Invite user to tenant/project | Invitation flow or admin add; audited | Partial — add member by user id |

---

## Epic C — Document storage & ingestion skeleton

| ID | Priority | Item | Acceptance criteria | Status |
|----|----------|------|---------------------|--------|
| C1 | P0 | S3 client + MinIO integration | Upload original; store document + version; private bucket | Done (Slice 2) |
| C2 | P0 | Pre-signed download | Authorized users only; CLEAN + ACCEPTED required | Done (Slice 2) |
| C3 | P0 | Durable enqueue on upload | Transactional outbox → ARQ (ADR-025) | Done (Slice 2B) |
| C4 | P1 | Worker: scan, promote, extract PDF/DOCX/… | Status transitions through READY/FAILED | Done (Slice 2) |
| C5 | P1 | Persist artifacts + evidence segments | Provenance retained; originals untouched | Done (Slice 2) |
| C6 | P1 | Arabic/English language metadata | Mixed docs don’t crash pipeline | Done (Slice 2) |
| C7 | P0 | Malware scan with env enforcement | ClamAV required in staging/prod; fake_test only in tests | Done (Slice 2B) |
| C8 | P2 | Upload UI (professional, accessible) | Progress + failure reasons; not a fake “smart analyze” button | Done (Slice 2) |
| C9 | P0 | Live MinIO/Redis/ClamAV/ARQ verification | GitHub Actions `live-ingestion.yml` (Mode B); no local Docker required | Ready for CI — not verified until workflow green |
| C10 | P0 | Readiness + reconciliation | Dependency-aware ready; reconcile dry-run | Done (Slice 2B) |
| C11 | P0 | Local non-Docker verification | `pnpm verify:local` (Mode A) | Done |

**Slice 3 (done):** Epic D structure + human-approved configuration revisions.  
**Slice 4 (done):** Deterministic deadline engine + human-confirmed project events (D3–D4, I2).

---

## Epic D — Contract package & obligation rules

| ID | Priority | Item | Acceptance criteria | Status |
|----|----------|------|---------------------|--------|
| D1 | P0 | `ContractPackage`, `ContractDocument`, `ContractClause`, obligation/notice-rule schema | Matches DOMAIN_MODEL §6 / Prisma | In progress — Slice 3 expanded for structure + review |
| D2 | P0 | Manual clause/obligation entry UI or admin API + human review | Human can confirm a minimal notice rule; `ReviewDecision` / configuration revision gates | In progress — Slice 3 expanded for structure + review |
| D3 | P1 | Deterministic deadline calculator in `packages/contract-rules` | Unit tests for calendar-day and working-day examples | Done — Slice 4 |
| D4 | P1 | Distinguish contractual vs recommended internal deadlines | Two deadline records + calculation trails | Done — Slice 4 |
| D5 | P2 | Assisted clause extraction (AI) into **proposed** rows | Adapter-only; schema-validated suggestions; fake/fixture provider test-only; no auto-approve (ADR-034) | Adapter-only with deterministic fixtures |

---

## Epic E — Event detection (five categories)

| ID | Priority | Item | Acceptance criteria |
|----|----------|------|---------------------|
| E1 | P0 | `EntitlementEvent` schema + category enum | Five initial categories only in Phase 1 UI |
| E2 | P0 | Detection pipeline entrypoint (historical scan job) | Runnable per project; idempotent enough to re-run safely |
| E3 | P1 | Rule-based detectors for each category (v1 heuristics) | Produce candidates with evidence links to source docs |
| E4 | P1 | Optional AI classifier proposals behind adapter | Outputs validated; labeled `interpretation` |
| E5 | P1 | Deduplicate obvious duplicates | Same category + overlapping dates/docs merge or link |
| E6 | P1 | Epistemic labeling in API responses | Client can render fact vs interpretation vs missing |
| E7 | P2 | Confidence calibration display guidance | UI copy states confidence ≠ legal certainty |

---

## Epic F — Evidence & missing information

| ID | Priority | Item | Acceptance criteria |
|----|----------|------|---------------------|
| F1 | P0 | Evidence requirement templates per category | Seed data for five categories |
| F2 | P0 | EvidenceLink create/list | Link event ↔ document version (+ optional page) |
| F3 | P1 | MissingEvidenceItem tracking | Missing/satisfied/waived with audit on waive |
| F4 | P1 | Event detail shows evidence and gaps | No orphan conclusions without sources |

---

## Epic G — Review queue & notice drafts

| ID | Priority | Item | Acceptance criteria |
|----|----------|------|---------------------|
| G1 | P0 | Review queue sorted by deadline urgency | Lists candidates for authorized roles |
| G2 | P0 | Event detail page | Deadlines + calculation trail + evidence + epistemic labels |
| G3 | P1 | Notice draft generation (template or AI-assisted) | Creates `draft`; never sends |
| G4 | P1 | Review decisions: approve / reject / request revision | State machine enforced server-side |
| G5 | P1 | Disclaimer: not final legal advice | Visible on event and notice views |
| G6 | P2 | Manual `NoticeDispatchRecord` | Optional human log that an approved notice was sent externally |
| G7 | P2 | Structured follow-up questions (minimal) | Open/answered on an event |

---

## Epic H — Audit, logging, security hardening

| ID | Priority | Item | Acceptance criteria |
|----|----------|------|---------------------|
| H1 | P0 | `AuditLog` writes for authz changes, uploads, review decisions | Append-only API + DB immutability (Slice 1B) | Partial — project/tenant audited; uploads/review later |
| H2 | P0 | Structured logging with redaction | No document body in info logs |
| H3 | P1 | Internal service auth web ↔ document-intelligence | Unauthorized calls rejected |
| H4 | P1 | Security checklist in SECURITY.md signed off for staging | Checklist complete |
| H5 | P2 | Basic rate limits on auth and upload | Partial — login rate limit (Slice 1B); upload later |

---

## Epic I — Fixtures, tests, documentation

| ID | Priority | Item | Acceptance criteria |
|----|----------|------|---------------------|
| I1 | P0 | Non-secret sample documents in `data/samples` | Synthetic GCC-flavored correspondence (en/ar) |
| I2 | P0 | Unit tests for deadline math | Edge cases: missing inputs → `incomplete_inputs` |
| I3 | P1 | Integration test: upload → extract → event candidate | Runs in CI with Compose services |
| I4 | P1 | Update README getting-started with real commands | Matches actual scripts |
| I5 | P2 | Workflow diagrams in `docs/workflows` | Historical scan + review loop |

---

## Suggested implementation slices (sprints)

### Slice 1 — Platform skeleton
A1–A6, B1–B4, Docker already running.

### Slice 1B — Verification & security hardening
Real Postgres migrate/seed/reset, FORCE RLS + `contractradar_app` role, audit immutability triggers, HMAC active-tenant cookie, login rate limit, seed credential safety, integration suite fail-closed (embedded Postgres when Docker unavailable). **Done** — do not start document ingestion until Slice 2.

### Slice 2 — Documents
C1–C6, H2–H3, I1. Immutable project document ingestion and evidence provenance. **Done** — SourceDocument/DocumentVersion/UploadSession/processing/evidence; MinIO + ARQ + fake/ClamAV adapters; do not start entitlement detection until Slice 3+.

### Slice 3 — Contract structure + human-approved configuration
D1–D2 (expanded), D5 adapter/fixtures. **Done** on `e8348ab`.

### Slice 4 — Deterministic deadlines + human-confirmed events
D3–D4, I2. Approved rule snapshots, project events/dates, calendars, calculation traces, tracked deadlines. No AI event detection. **Done**.

### Slice 5 — Evidence-backed event detection (next)
Human-confirmed detection from correspondence/project records before deadline activation. Do not auto-activate deadlines from AI suggestions.

---

## Definition of Done (Phase 1)

- [ ] A project can be scanned historically for all five categories.
- [ ] Every candidate event shows sources, epistemic labels, and deadline math (or explicit incomplete inputs).
- [ ] Notice drafts require human approval; no auto-send exists.
- [ ] Cross-tenant tests pass.
- [ ] Arabic and English sample docs both flow through ingestion.
- [ ] Audit log captures review decisions and privilege changes.
- [ ] README reflects runnable reality — no theatrical placeholders.
