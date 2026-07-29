# ContractRadar — Product Roadmap

Phases are sequential for dependency reasons, but engineering spikes may overlap when they reduce risk (e.g., deadline math library before UI).

---

## Phase 0 — Foundation (current)

**Objective:** Establish architecture, domain model, security posture, and repository structure without fake product surfaces.

**Deliverables**

- [x] Repository inspection and empty-state baseline
- [x] Recommended production stack
- [x] Monorepo folder structure
- [x] README, ARCHITECTURE, DOMAIN_MODEL, ROADMAP, DECISIONS, SECURITY
- [x] Phase 1 backlog
- [x] Local data-plane Docker Compose (Postgres, Redis, MinIO)

**Exit criteria:** Team can implement Phase 1 against agreed entities and boundaries.

---

## Phase 1 — Historical scan MVP

**Objective:** A tenant can upload a project’s historical records, detect candidate events in five categories, calculate deadlines transparently, link evidence, and run a human review loop including draft notices that are never auto-sent.

**Capabilities**

- Auth, RBAC, tenant + project isolation
- Document upload to S3-compatible storage; immutable versions
- Ingestion pipeline skeleton with real status transitions
- Contract package + human-confirmed clause/obligation register — **Slice 3 done**
- Deterministic deadline engine + human-confirmed project events — **Slice 4 done** (ADR-037–047)
- Evidence-backed event detection with mandatory human confirmation — **Slice 5 done (Mode A)** (ADR-048–058); suggestions never auto-activate deadlines
- Controlled delivery with human authorization, dispatch evidence, acknowledgments — **Slice 7** (ADR-074–086); no autonomous send
- Connectors, operational alerts, project/portfolio dashboards — **Slice 8** (ADR-087–102); import-only connectors; no autonomous legal state mutation
- Historical detection for:
  1. Late drawings or approvals
  2. Suspension or restricted site access
  3. Scope changes or additional work
  4. Delayed payment
  5. Unforeseen site conditions
- Deadline engine (contractual vs recommended internal) with calculation trails
- Evidence requirements + missing evidence
- Event review queue + notice draft approval workflow
- Audit log for critical actions
- Arabic + English document language handling at ingestion

**Exit criteria**

- End-to-end path on sample (non-secret) fixtures works in local Docker.
- Cross-tenant access tests pass.
- No UI path implies legal finality or auto-send.

Detailed backlog: [docs/backlog/phase-1.md](./docs/backlog/phase-1.md)

---

## Phase 2 — Contract intelligence depth

**Objective:** Improve clause understanding for FIDIC-based and heavily amended GCC contracts; strengthen bilingual correspondence analysis.

**Capabilities**

- Richer clause/obligation modeling and amendment overlays
- Improved Arabic/English correspondence classification
- Better deduplication of events across letter chains
- Search across bilingual extractions
- Reviewer UX for confirming/rejecting clause links at scale
- Exportable evidence packs for an event

**Exit criteria:** Measurable reduction in reviewer time to confirm clause links on amended contracts; bilingual precision targets agreed with domain experts.

---

## Phase 3 — Live monitoring

**Objective:** Move from batch historical scan to continuous monitoring without changing the review philosophy.

**Capabilities**

- Connector framework (email / EDMS) with incremental sync
- Scheduled deadline watchers and urgency escalation
- Structured follow-up questions to project personnel
- Notification preferences (in-app; email alerts for humans — not notice dispatch)
- Pipeline SLAs and queue observability

**Exit criteria:** A live project can surface new candidates within an agreed latency budget; notices still require human approval; connectors fail closed per tenant.

---

## Phase 4 — Schedule & commercial context

**Objective:** Connect entitlement events to programme and commercial impact **without** presenting guesses as confirmed amounts.

**Capabilities**

- Schedule import (P6/MS Project exports) and activity links
- Concurrent delay flags as interpretations with sources
- Provisional entitlement value ranges with explicit labeling
- Variation / payment certificate cross-references
- Portfolio dashboards for multi-project contractors

**Exit criteria:** Commercial ranges always show basis + epistemic status; no “confirmed claim value” without a separate human approval construct.

---

## Phase 5 — Learning loops & enterprise delivery

**Objective:** Learn from reviewer feedback under human control; ship enterprise deployment options.

**Capabilities**

- Feedback capture on false positives/negatives; training/eval sets with tenant isolation
- Prompt/rule versioning with measurable quality gates
- SSO (SAML/OIDC), MFA policies, SCIM (as required)
- Client-hosted / private cloud packaging
- Optional local/air-gapped model adapters
- Advanced audit export and retention policies
- Future event categories: acceleration, out-of-sequence work, verbal instructions, late handover, utility conflicts, design revisions, material approval delays, consultant non-response, exceptional weather, concurrent delay

**Exit criteria:** Enterprise customer can deploy privately with documented security controls; model updates require evaluation gates; human control preserved.

---

## Cross-cutting work (all phases)

- Security reviews and dependency hygiene
- Accessibility and RTL UI quality
- Performance budgets for large document sets
- Legal/compliance review of disclaimers and workflow copy
- Domain expert validation of deadline math and clause rules

---

## Explicitly deferred

- Autonomous notice sending
- Mobile-native applications
- Marketplace of third-party plugins (until API stability)
- Guaranteed win-prediction or “claim success scores” marketed as certainty

### Slice 6 (done — Mode A)
Evidence completion, reviewer questions, deterministic/AI-assisted notice drafting, human approval, and export-ready packages. **No automatic delivery.**

### Slice 8 (done — Mode A)
`ConnectorAccount` + approved `ConnectorProjectScope` (`IMPORT_ONLY`); `ExternalRecord` identity; import via existing ingestion/outbox/ARQ; fake/local connectors CI-only; deterministic operational alerts and dashboards; portfolio respects membership. ADRs 087–102. Threat model: [docs/threat-models/connectors-and-operations.md](./docs/threat-models/connectors-and-operations.md). **No autonomous event confirmation, deadline activation, or notice dispatch.** Next: production hardening / real provider onboarding / pilot readiness (not started).
