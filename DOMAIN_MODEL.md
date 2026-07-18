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
| **Obligation rule** | Machine-evaluable requirement derived from clauses (e.g., notice period) |
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
  │     ├── ContractPackage → Amendment → ContractClause → ObligationRule
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
- Permissions are derived from roles (RBAC). Custom roles may be added later without changing entity shape.

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
- Replacing a file always creates a new version.

### DocumentExtraction

- `id`, `document_version_id`, `extractor_version`, `pipeline_run_id`
- `raw_text` / segmented text references (may live in object storage for large bodies)
- `structured_payload` (JSONB): parties, dates, refs, language segments
- `provenance` for each extracted field (page, offsets, confidence)
- `epistemic` tags per field

**Rule:** Originals and extractions are both preserved. Corrections create new extraction versions; they do not overwrite silently.

---

## 6. Contract intelligence

### ContractPackage

- Links a project to its governing contract set.
- `base_form` (e.g., `fidic_red_1999`, `fidic_yellow_2017`, `bespoke`, `unknown`)
- `governing_law`, `contract_language`, `signed_date`, `commencement_date`
- Status: `draft_register` | `human_confirmed`

### Amendment

- `contract_package_id`, `document_id`, `effective_date`, `summary`
- Ordered overlay affecting clause interpretation.

### ContractClause

- `contract_package_id`, `clause_ref` (e.g., `20.1`), `title`
- `text_en`, `text_ar` (either may be null if not available)
- `source_document_version_id`, `confirmation_status`
- Parent/child for sub-clauses if needed.

### ObligationRule

- Derived, structured rule used by engines:
  - `trigger_type` (e.g., `notice_of_claim`)
  - `period_value`, `period_unit` (days/weeks)
  - `calendar_type` (calendar_days, working_days)
  - `awareness_basis` (event_date, became_aware_date)
  - `form_requirements`, `notify_parties`
  - `source_clause_id`, `rule_version`, `human_confirmed`

Deterministic deadline calculation consumes `ObligationRule`, never free-text clause prose alone.

---

## 7. Entitlement events

### EntitlementEvent

- `id`, `tenant_id`, `project_id`
- `category` (initial enum below)
- `title`, `summary`
- `event_date`, `awareness_date` (each with epistemic status + source)
- `status`: `candidate` | `under_review` | `needs_information` | `approved_for_notice` | `rejected` | `closed` | `waived`
- `detection_source`: `historical_scan` | `live_monitor` | `manual`
- `confidence` (model/rule score — never shown as legal certainty)
- `created_at`, `updated_at`

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

- Join between event and `ContractClause` / `ObligationRule`
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
  - `obligation_rule_id` + `rule_version`
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
3. Contractual deadlines require a human-confirmed `ObligationRule` or an explicitly labeled assumption.
4. Notice drafts cannot be marked dispatched without an `approved` status and a human `NoticeDispatchRecord`.
5. AI outputs persist as `interpretation` until review.
6. Cross-tenant references are impossible via application APIs.
7. Monetary fields never use IEEE floating point as the source of truth.
