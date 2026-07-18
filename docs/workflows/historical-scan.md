# Workflow — Historical project scan

Phase 1 primary workflow.

## Actors

- Project admin / commercial reviewer
- System (ingestion + detection pipelines)
- Contracts manager (clause confirmation)

## Steps

1. **Create project** under a tenant (country, timezone, calendar, languages).
2. **Confirm contract register** — base form, key notice clauses, obligation rules (human-confirmed for production use).
3. **Upload historical records** — contracts, correspondence, RFIs, instructions, minutes, reports, schedules, payment records, etc.
4. **Ingestion** — store originals immutably; extract text; tag language; persist extractions with provenance.
5. **Run historical scan** — detectors emit entitlement event candidates for the five Phase 1 categories.
6. **Calculate deadlines** — deterministic engine writes contractual + recommended internal deadlines with calculation trails (or marks incomplete inputs).
7. **Build evidence checklist** — link found evidence; list missing items.
8. **Enter review queue** — humans triage; system does not send notices.

## Outputs

- Candidate `EntitlementEvent` records
- `Deadline` + `DeadlineCalculation` rows
- `EvidenceLink` / `MissingEvidenceItem` rows
- Audit entries for uploads and scan runs

## Failure modes

- Extraction failure → document `failed` with reason; scan skips or partially proceeds with logged gaps.
- Missing obligation rules → deadlines `incomplete_inputs`; event still reviewable.
- Low-confidence detection → still `interpretation`; never auto-approved.
