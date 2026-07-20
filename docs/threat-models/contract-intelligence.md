# Threat model — Contract intelligence (Slice 3)

Scope: contract packages, clause/obligation structuring, notice rules, configuration revisions, human review, and AI-assisted extraction suggestions. Entitlement-event and project-event deadline engines are out of scope for Slice 3 (ADR-036).

| Threat | Mitigation |
|--------|------------|
| Fabricated clauses | Persist immutable `sourceText` + checksum; require evidence segment/locator; human review before verification; reject suggestions without schema-valid evidence refs |
| Missing pages / incomplete extract | Configuration issues (`MISSING_CONTRACT_DOCUMENT`, `UNREADABLE_CLAUSE`); package stays `REVIEW_REQUIRED` / not fully approved; no silent fill-in from models |
| Amendment conflicts | Explicit `ContractDocumentRelationship` + ranked `ContractPrecedenceRule`; `CONFLICTING_AMENDMENT` issues; machine ranks not auto-active |
| Prompt injection via contract text | Treat document text as untrusted input; schema-validate structured outputs; never execute model text; suggestions only, never auto-approve (ADR-034) |
| Unsafe HTML in extracts / reviewer notes | Store plain text / sanitized fields; render escaped in UI; no raw HTML execution from clause or rationale bodies |
| Hallucinated obligations / notice rules | Epistemic labels; `MACHINE_SUGGESTED` default; separate machine vs human-approved interpretation; fixture/fake provider test-only |
| Overconfident time-bar conclusions | `timeBarClassification` defaults `UNCERTAIN`; candidate flags only; ambiguity statuses; no Slice 3 deadline expiry product claims (ADR-031, ADR-036) |
| Cross-tenant evidence linkage | FORCE RLS + tenant/project keys on all contract entities; evidence refs resolved within tenant; authz on every API |
| Forged approval | Server-side capability checks; `ReviewDecision` with authenticated actor; approved revisions immutable; no client-supplied “approved” without server transition |
| Malicious reviewer input | Length limits; sanitize rationale/notes; audit before/after state; no privilege escalation via entity payloads |
| Unapproved rule activation | Only `APPROVED` + `isActiveApproved` configuration revision is authoritative; unreviewed notice/obligation rules cannot activate engines |
| Bilingual conflicts | `BILINGUAL_CONFLICT` issues; language-scoped precedence only when confirmed; no silent language preference (ADR-035) |
| Stale revisions | Immutable approved snapshots; supersession model; engines (when built) pin active approved revision only (ADR-032) |
| Provider data leakage | Adapter policy: minimal segments sent; no full-body logging; fake provider refused outside tests; record provider/model metadata for audit without echoing secrets |

## Trust boundaries

- **Ingestion custody** (Slice 2) remains the source of document bytes; contract intelligence binds to `DocumentVersion` / evidence segments — it does not re-admit quarantine content.
- **AI adapters** produce suggestions only; human review + configuration revision approval are the trust upgrade path.
- **`packages/contract-rules`** in Slice 3 validates/normalizes structure only — it does not assert project-event deadlines or legal finality.

## Explicit non-claims (Slice 3)

- Slice 3 documentation and schema work do **not** mean contract intelligence is product-verified end-to-end.
- Live LLM providers are not required for Mode A; fake/fixture providers are test-only.
- No auto-send of notices; contact points are not dispatch endpoints.
