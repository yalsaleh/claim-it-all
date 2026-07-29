# ContractRadar — Domain Model

This document defines the primary business entities, their meaning, and relationships. Implementation schemas (Prisma) must map cleanly to this model. Epistemic honesty is part of the domain: the system must distinguish facts, interpretations, assumptions, missing information, and human-approved conclusions.

---

## 1. Ubiquitous language

| Term | Meaning |
|------|---------|
| **Tenant** | Customer organization boundary for data isolation |
| **Project** | A construction project under a tenant |
| **Document** | An ingested project record (contract, letter, RFI, etc.) |
| **Contract package** | Governing agreement set for a project (base + amendments) |
| **Clause** | A contractual provision with identity and text |
| **Contract configuration revision** | Versioned, human-approved snapshot of structured interpretation |
| **Obligation / notice rule** | Structured duty and notice-timing fields; executable only via approved configuration snapshots |
| **Entitlement event** | A detected project occurrence that may give rise to entitlement / notice duties |
| **Evidence** | Source material supporting an event or notice |
| **Deadline** | A calculated date for contractual or internal action |
| **Notice draft** | System-assisted contractual notice text awaiting human decision |
| **Review** | Human decision on an event or draft |
| **Follow-up** | Structured question to project personnel to close information gaps |
| **Audit record** | Immutable log of a security- or compliance-relevant action |

---

## 2. Entity relationship overview

```
Tenant
  ├── UserMembership (User ↔ Tenant Role)
  ├── Project
  │     ├── ProjectMembership (User ↔ Project Role)
  │     ├── Document → DocumentVersion → DocumentExtraction
  │     ├── ContractPackage → ContractDocument → ContractClause → ContractObligation → NoticeRule
  │     │                         └── ContractConfigurationRevision (human-approved snapshot)
  │     ├── EntitlementEvent
  │     │     ├── EventClassification
  │     │     ├── EventClauseLink
  │     │     ├── EvidenceLink → DocumentVersion (+ span)
  │     │     ├── EvidenceRequirement / MissingEvidenceItem
  │     │     ├── Deadline → DeadlineCalculation
  │     │     ├── FollowUpQuestion → FollowUpAnswer
  │     │     ├── ScheduleLink (later)
  │     │     ├── CommercialImpactEstimate (later, provisional)
  │     │     └── NoticeDraft → NoticeReview → NoticeDispatchRecord
  │     └── IngestionJob / PipelineRun
  └── AuditLog
```

---

## 3. Tenancy and identity

### Tenant

- `id`, `name`, `slug`, `status`, `primary_locale`, `supported_locales`, `created_at`
- Isolation root for all customer data.

### User

- `id`, `email`, `name`, `locale_preference`, `status`, `created_at`
- Global identity; access granted only via memberships.

### Membership & roles

- `TenantMembership`: user + tenant + tenant-level role
- `ProjectMembership`: user + project + project-level role
- Permissions are derived from roles via **capabilities** in `@contractradar/authz` (not scattered role-name checks).

**Tenant roles (Slice 1):** `TENANT_OWNER`, `TENANT_ADMIN`, `COMMERCIAL_MANAGER`, `CONTRACTS_MANAGER`, `PROJECT_MANAGER`, `REVIEWER`, `VIEWER`

**Project roles (Slice 1):** `PROJECT_ADMIN`, `COMMERCIAL_LEAD`, `CONTRACTS_LEAD`, `PROJECT_MANAGER`, `REVIEWER`, `CONTRIBUTOR`, `VIEWER`

Elevated tenant roles may read all tenant projects; `REVIEWER` / `VIEWER` tenant roles are project-scoped through `ProjectMembership`.

---

## 4. Project

### Project

- `id`, `tenant_id`, `name`, `code`, `country_code`, `base_currency`, `status`
- `timezone`, `default_calendar_id`
- `primary_language`, `secondary_language` (typically `en` / `ar`)
- Optional commercial metadata: client name, contract sum reference (not used as confirmed entitlement).

### ProjectSettings

- Internal deadline lead-time policies
- Notice draft templates preferences
- Feature flags at project level (e.g., live monitoring off/on)

---

## 5. Documents and extraction

### Document

- `id`, `tenant_id`, `project_id`
- `doc_type` (enum: contract, amendment, correspondence, rfi, engineer_instruction, meeting_minutes, daily_report, schedule, variation_register, payment_record, site_record, drawing, cost_evidence, other)
- `title`, `source_channel` (upload, connector — Phase 1: upload)
- `language`, `status` (pending, processing, ready, failed)
- `content_hash`, `received_at`, `document_date` (nullable fact)

### DocumentVersion

- Immutable bytes pointer: `storage_key`, `byte_size`, `mime_type`, `checksum`
- `version_number`, `uploaded_by`, `created_at`
- Custody fields: `uploadStatus`, `malwareScanStatus`, `processingStatus`
- Quarantine keys until CLEAN scan; then promoted under `/originals/`
- Replacing a file always creates a new version.

### OutboxEvent

- Durable job intent written in the same transaction as upload acceptance
- Payload: processing/version/correlation IDs only (ADR-025)

### DocumentExtraction

- `id`, `document_version_id`, `extractor_version`, `pipeline_run_id`
- `raw_text` / segmented text references (may live in object storage for large bodies)
- `structured_payload` (JSONB): parties, dates, refs, language segments
- `provenance` for each extracted field (page, offsets, confidence)
- `epistemic` tags per field

**Rule:** Originals and extractions are both preserved. Corrections create new extraction versions; they do not overwrite silently.

---

## 6. Contract intelligence

Aligned with Prisma models under Slice 3–4. **Slice 5 (in progress)** adds `ProjectEventSuggestion` detection from correspondence; suggestions are never confirmed events, entitlements, or deadlines until human accept (ADR-048–058). Slice 4 still requires human-confirmed project events before deadline calculation (ADR-037–047).

### ContractPackage

- Project-scoped container for the governing agreement set.
- Metadata: `contractFormFamily` / `contractFormEdition`, `governingLaw`, `jurisdiction`, `governingLanguage` / `secondaryLanguage`, `effectiveDate`, `commencementDate`.
- Status: `DRAFT` | `INGESTING` | `STRUCTURING` | `REVIEW_REQUIRED` | `PARTIALLY_APPROVED` | `APPROVED` | `SUPERSEDED` | `ARCHIVED`.
- Optional pointer `currentConfigurationRevisionId` to the working or active configuration revision.

### ContractDocument

- Binds an ingested `SourceDocument` + `DocumentVersion` into a package.
- Typed role (`AGREEMENT`, `GENERAL_CONDITIONS`, `PARTICULAR_CONDITIONS`, `AMENDMENT`, …), language, precedence rank hint, executed/current flags.
- Status: `DRAFT` | `REVIEW_REQUIRED` | `ACTIVE` | `SUPERSEDED` | `ARCHIVED` | `REJECTED`.
- Relationships (`ContractDocumentRelationship`) and ranked `ContractPrecedenceRule` rows model amendments and overlays (replaces earlier standalone `Amendment` sketch).

### ContractClause

- Logical provision under a `ContractDocument` / `DocumentVersion`.
- Immutable `sourceText` (+ checksum); optional `normalizedText`; corrections via `ClauseTextRevision`.
- Numbering, heading, hierarchy (`parentClauseId`), language, evidence locator, extraction method, `reviewStatus`.
- Supporting graph: `ClauseRelationship`, `DefinedTerm`, `ClauseTermReference`, `CrossReference`.

### ContractObligation

- Structured duty derived from a source clause (replaces earlier `ObligationRule` sketch name).
- Parties/roles, action/trigger/condition text, timing expression, form/content/delivery requirements, consequence text.
- Candidate flags for time-bar / condition precedent; separate machine vs human-approved interpretation; `reviewStatus`.
- Children: `ObligationTrigger`, `ObligationRecipient`, `ObligationEvidenceRequirement`.

### NoticeRule

- Structured notice-timing representation attached to an obligation.
- Duration, calendar basis, counting convention, start/end rules, holiday calendar link, recipient/content/delivery requirements.
- `timeBarClassification` (default `UNCERTAIN`), `ambiguityStatus`, `reviewStatus`.
- Slice 3 stores and validates structure; Slice 4 executes only **approved notice-rule snapshots** against human-confirmed events and calendars.

### ContractConfigurationRevision

- Versioned snapshot of structured interpretation (`DRAFT` → `IN_REVIEW` → `APPROVED` / `CHANGES_REQUESTED` / `WITHDRAWN` / `SUPERSEDED`).
- Approved revisions are immutable; at most one `isActiveApproved` per package.
- Related: `ContractConfigurationIssue`, `CalendarRule`, `ReviewDecision`.
- AI path: `ContractAnalysisRun` → `ContractExtractionSuggestion` (pending review only; ADR-034).

Downstream deadline engines consume **human-approved** notice/obligation structure from an active approved revision — never free-text clause prose alone. Detection suggestions (Slice 5) are not deadline inputs until human accept + Slice 4 gates.

---

## 7. Entitlement events

### Suggestion vs confirmed event (Slice 5)

| Entity | Role |
|--------|------|
| `ProjectEventSuggestion` | Detection candidate (`PENDING_REVIEW`); interpretation only; never a fact, entitlement, or deadline (ADR-048) |
| `ProjectEventDateSuggestion` | Unverified date candidate; relative dates only with a reliable source timestamp (ADR-052) |
| `ProjectEvent` | Human-confirmed (or manually created) factual record for Slice 4 confirmation / calculation gates (ADR-038) |
| `ProjectEventDate` | Verified trigger-relevant dates after human verification (ADR-039) |

Accepting a suggestion may create a `ProjectEvent` transactionally; it does **not** confirm rule applicability or activate a deadline (ADR-054). Rule-candidate matches reference only active `ApprovedNoticeRuleSnapshot` rows and stay advisory until HUMAN_CONFIRMED (ADR-058).

### EntitlementEvent

- `id`, `tenant_id`, `project_id`
- `category` (initial enum below)
- `title`, `summary`
- `event_date`, `awareness_date` (each with epistemic status + source)
- `status`: `candidate` | `under_review` | `needs_information` | `approved_for_notice` | `rejected` | `closed` | `waived`
- `detection_source`: `historical_scan` | `live_monitor` | `manual`
- `confidence` (model/rule score — never shown as legal certainty)
- `created_at`, `updated_at`

Product “entitlement event” language in UI may map onto confirmed `ProjectEvent` workflows after review; detection outputs remain suggestions until accept.

### Initial categories

1. `late_drawings_or_approvals`
2. `suspension_or_restricted_access`
3. `scope_change_or_additional_work`
4. `delayed_payment`
5. `unforeseen_site_conditions`

Future categories extend the enum without rewriting the event entity.

### EventClassification

- Why the system labeled the event: rule hits, model labels, feature flags.
- Stores `epistemic_status = interpretation` until human confirmation.

### EventClauseLink

- Join between event and `ContractClause` / `ContractObligation` / `NoticeRule`
- `relevance_rationale`, `link_status` (`proposed` | `confirmed` | `rejected`)

---

## 8. Deadlines

### Deadline

- `entitlement_event_id`
- `kind`: `contractual` | `recommended_internal`
- `due_at` (date or timestamptz per rule)
- `status`: `incomplete_inputs` | `calculated` | `superseded` | `met` | `missed`
- Distinct rows for contractual vs internal recommended dates.

### DeadlineCalculation

- Append-only explanation:
  - inputs (event_date, awareness_date, period, calendar_id)
  - formula identifier / version
  - intermediate steps
  - `notice_rule_id` + configuration revision id (when engines exist)
  - actor (`system` or user override with reason)

**Invariant:** A displayed deadline must reference a `DeadlineCalculation`. Overrides are audited and marked as human assumptions/approvals.

---

## 9. Evidence

### EvidenceRequirement

- Template per event category (and optionally per clause):
  - `code`, `description_en`, `description_ar`, `required` boolean

### EvidenceLink

- `event_id` (or `notice_draft_id`)
- `document_version_id`
- Optional `span` (page, start, end, bbox)
- `note`, `linked_by`, `created_at`

### MissingEvidenceItem

- `event_id`, `requirement_id`
- `status`: `missing` | `satisfied` | `waived`
- `waiver_reason` (required if waived)

---

## 10. Notices and reviews

### NoticeDraft

- `event_id`, `version_number`
- `language`, `body`, `subject`
- `generation_method`: `ai_assisted` | `template` | `manual`
- `status`: `draft` | `pending_review` | `approved` | `rejected` | `revised` | `superseded`
- `model_run_id` (nullable)
- **Never auto-transitions to sent.**

### NoticeReview

- `notice_draft_id`, `reviewer_id`
- `decision`: `approve` | `reject` | `request_revision`
- `comments`, `created_at`

### NoticeDispatchRecord

- Human-acknowledged send log only:
  - `notice_draft_id`, `dispatched_by`, `dispatched_at`
  - `channel` (email, hand_delivery, portal, other)
  - `reference_number`, `proof_document_version_id` (optional)
- System does not perform autonomous dispatch in Phase 1–3 architecture.

---

## 11. Follow-ups

### FollowUpQuestion

- `event_id`, `prompt_en`, `prompt_ar`
- `response_type` (text, date, enum, document_request)
- `status`: `open` | `answered` | `dismissed`
- `asked_of_user_id` / role target

### FollowUpAnswer

- `question_id`, `answered_by`, `payload`, `answered_at`
- May create/update facts on the event with provenance `human_provided`.

---

## 12. Schedule and commercial (later entities)

Designed now; implemented in later phases.

### ScheduleActivity / ScheduleLink

- Link event ↔ activity IDs from imported programmes.
- Support concurrency flags as interpretations, not facts, unless source-backed.

### CommercialImpactEstimate

- `currency`, `amount_min`, `amount_max`, `basis`
- Always labeled **provisional / non-binding**.
- Forbidden to display as “confirmed entitlement value” without human approval workflow (future).

---

## 13. Jobs and pipeline runs

### IngestionJob

- Tracks upload-to-ready lifecycle; stores error codes, attempts, tenant/project ids.

### PipelineRun

- Generic run record for extraction, detection, deadline recalculation.
- Links to AI run metadata (provider, model, prompt version) without storing secrets.

---

## 14. AuditLog

See ARCHITECTURE.md §13. Domain requirement: security- and compliance-relevant mutations produce an `AuditLog` entry in the same transaction where practical.

---

## 15. State machines (summary)

### EntitlementEvent.status

```
candidate → under_review → needs_information → under_review
                      ↘ approved_for_notice → closed
                      ↘ rejected → closed
                      ↘ waived → closed
```

### NoticeDraft.status

```
draft → pending_review → approved
                      ↘ rejected
                      ↘ revised → pending_review
approved → superseded (when a new version is created)
```

Sending is **outside** this state machine except as an optional `NoticeDispatchRecord` attached to an `approved` draft.

---

## 16. Epistemic field pattern

Reusable value object for uncertain data:

```
EpistemicValue<T> {
  value: T | null
  status: fact | interpretation | assumption | missing | human_approved
  source_refs: SourceRef[]
  confidence?: number  // model only; not legal certainty
  notes?: string
}
```

Applied to dates, clause links, category labels, commercial ranges, and awareness bases.

---

## 17. Invariants (enforce in code)

1. Every project-owned entity has `tenant_id` and `project_id` consistent with the project.
2. Document bytes are immutable per `DocumentVersion`.
3. Contractual deadlines require a human-confirmed `NoticeRule` / obligation on an active approved configuration revision, or an explicitly labeled assumption.
4. Notice drafts cannot be marked dispatched without an `approved` status and a human `NoticeDispatchRecord`.
5. AI outputs persist as `interpretation` until review.
6. Cross-tenant references are impossible via application APIs.
7. Monetary fields never use IEEE floating point as the source of truth.

## NoticePackage (Slice 6)

Runtime aggregate for evidence completion → approved NoticeFacts → structured NoticeDraftRevision → human approval → export bundle. Stops before delivery. See ADR-059–073.


### Slice 7 delivery entities

`NoticeDispatchPackageSnapshot`, `NoticeDispatchAuthorization`, `NoticeDispatchAttempt`, `NoticeDispatchRecipient`, `ManualDispatchRecord`, `DispatchEvidence`, `NoticeReceiptAssessment`, `DeemedReceiptAssessment`, `NoticeAcknowledgment`, `DeliveryProviderEvent`, `DeliveryProviderConfiguration`. Provider delivery ≠ contractual service.

### Slice 8 connectors and operations

`ConnectorAccount` (secret references only; statuses DRAFT→APPROVED/DISABLED/REVOKED), `ConnectorProjectScope` (`IMPORT_ONLY`; explicit approval), `ConnectorSyncRun`, `ExternalRecord` (provider identity + provenance; links to `SourceDocument`/`DocumentVersion`), `ConnectorProviderEvent` (append-only webhooks), `OperationalAlert` / `OperationalAlertEvent`, `EscalationPolicy` / `EscalationStep`, `OperationalTask`, `InternalNotification` (separate from contractual dispatch), `ProjectTimelineEvent`, `ProjectOperationsSummary`, `OperationalSavedView`. Imported records are evidence, not conclusions. Sync never confirms events, activates deadlines, or sends notices.
