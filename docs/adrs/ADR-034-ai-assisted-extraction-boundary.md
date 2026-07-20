# ADR-034 — AI-assisted extraction boundary

## Status
Accepted (Slice 3)

## Context
Assisted clause/obligation extraction can speed structuring but must not invent operative law, auto-approve rules, or lock the product to one vendor.

## Decision
- AI extraction is **adapter-only** behind a provider-neutral interface (aligns with ADR-005).
- Outputs land as `ContractExtractionSuggestion` / analysis-run artifacts with status `PENDING_REVIEW` — never as approved configuration.
- **No auto-approve.** Human review (ADR-033) is mandatory before linked entities become confirmed.
- Prefer the **smallest evidence segments** that support a suggestion; refuse unbounded “whole document” citations as sole evidence when finer locators exist.
- Structured outputs must be **schema-validated** before persistence; invalid payloads are rejected, not coerced into rules.
- Production/staging must not use a fake provider. A **fake / fixture provider is test-only** (deterministic fixtures for CI and local Mode A), analogous to malware `fake_test` discipline.
- Persist provider/model metadata on suggestions for audit; do not log full contract bodies to external systems beyond the minimum required by the approved adapter policy.

## Consequences
- Slice 3 can ship structure + review with deterministic fixtures without claiming live LLM verification.
- Vendor swap does not change domain gates or epistemic labeling.
