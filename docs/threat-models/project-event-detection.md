# Threat model — Project event detection (Slice 5)

Scope: evidence-backed `ProjectEventSuggestion` generation from correspondence/project records, optional AI adapters, duplicate/merge proposals, and human acceptance into `ProjectEvent`. Confirmed deadline calculation remains Slice 4 (ADR-037–047). Threat model for calculation: [deadline-engine.md](./deadline-engine.md).

## Threats and mitigations

| Threat | Mitigation |
|--------|------------|
| Prompt injection via document/OCR text | Treat document text as data never instructions (ADR-057); schema-validate AI outputs; never execute model text; suggestions stay `PENDING_REVIEW` |
| Forged evidence IDs in model output | Resolve evidence only within provided tenant/project/context; reject unknown or cross-project segment ids; store validated refs only |
| Auto deadline activation from suggestions | Accept creates `ProjectEvent` only (ADR-054); no applicability confirmation; no calculation/activation; Slice 4 gates unchanged |
| Invented or relative dates treated as verified | `ProjectEventDateSuggestion` unverified (ADR-052); relative dates require reliable source timestamp; calculation needs VERIFIED EXACT_* (ADR-039) |
| Cross-tenant / cross-project leakage | `DetectionContextGroup` and all entities carry tenant/project keys; FORCE RLS; no cross-tenant grouping or merge (ADR-051, ADR-053) |
| Silent overwrite of reviewer decisions | Incremental scan by document version; never overwrite historical suggestions (ADR-056); append-only feedback (ADR-055) |
| Destructive auto-merge dropping evidence | Duplicate signals advisory; human merge only; preserve evidence and suggestion identity (ADR-053) |
| Unapproved / draft rule matching | Candidates only from active `ApprovedNoticeRuleSnapshot` (ADR-058); applicability remains human-confirmed (ADR-040) |
| Fake AI in production | Fake/fixture provider test-only; refused outside test env (ADR-050), same discipline as ADR-034 |
| Overconfident “legal accuracy” claims | Epistemic labels; confidence ≠ certainty; synthetic benchmarks not legal accuracy (ADR-055) |
| Suggestion confused with entitlement fact | Separate `ProjectEventSuggestion` vs `ProjectEvent` (ADR-048); UI/API labels; accept ≠ entitlement conclusion |
| Malicious reviewer notes / HTML | Length limits; escaped render; audit actor + before/after; no privilege escalation via payloads |
| Detector non-determinism / hidden side effects | Pure versioned detectors in `@contractradar/event-detection` — no DB/AI (ADR-049) |
| Stale or hostile configuration | Pin active approved revision for candidates; missing active config → no invented rules |

## Trust boundaries

- **Ingestion custody** supplies immutable `DocumentVersion` / evidence segments; detection does not re-admit quarantine content.
- **`@contractradar/event-detection`** emits candidates only; persistence and authz live in web/server orchestration.
- **AI adapters** produce structured suggestions only; human accept + Slice 4 confirmation are the trust upgrade path to deadlines.
- **Deadline engine** never reads raw suggestions as trigger facts.

## Explicit non-claims (Slice 5)

- Documentation of detection ADRs does **not** mean live commercial LLM detection is product-verified.
- Fixture/fake AI pass rates are engineering regression checks, not legal certification.
- Accepted suggestions are not entitlement conclusions, time-bar determinations, or notice-ready deadlines.
