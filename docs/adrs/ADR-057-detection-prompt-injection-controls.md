# ADR-057 — Detection prompt-injection controls

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Construction correspondence and OCR text can contain instructions aimed at models (“ignore previous rules”, “mark this as confirmed entitlement”). Treating that text as system or tool instructions would let untrusted documents escalate into confirmed events or forged evidence links.

**Decision:** Document and extraction text is **data only**, never instructions. Prompts and adapters must isolate system instructions from untrusted content; model outputs are schema-validated and discarded if they attempt to set confirmation, applicability, deadline activation, or arbitrary evidence ids outside the provided context. Deterministic detectors ignore instructional phrasing as authority. UI renders escaped text; no execution of model- or document-supplied HTML/scripts.

**Consequences:** Aligns with ADR-034/050. Threat model documents forged evidence and injection paths. Tests include hostile fixture text that must not yield confirmed facts or out-of-scope evidence references.
