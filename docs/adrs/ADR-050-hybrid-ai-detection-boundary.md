# ADR-050 — Hybrid AI detection boundary

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** LLMs can propose categories and spans from correspondence, but they invent dates, overstate certainty, and are easy to overtrust as legal conclusions. Slice 3 already bounded AI extraction (ADR-034); event detection needs the same discipline.

**Decision:** AI detection is optional and adapter-based (ADR-005). Outputs must be schema-validated structured suggestions only — never confirmed events, verified dates, executable rules, or activated deadlines. A fake/fixture provider is test-only and refused in production-like environments. Persist provider/model/prompt versions on runs; treat document text as data (ADR-057). Deterministic detectors remain the default path when AI is disabled.

**Consequences:** Mode A and CI can ship detection with fixtures without live LLM claims. Product copy must not equate model confidence with legal certainty. Acceptance and date verification stay human-gated (ADR-052, ADR-054). Vendor swap does not change domain gates.
