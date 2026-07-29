# ADR-083 — Deemed receipt assessment

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Contracts may deem notice received after elapsed time or defined conditions; the platform should advise, not adjudicate.

**Decision:** Compute deemed-receipt indicators from pinned notice rules, dispatch timestamps, provider events, and configured deeming clauses. Output is advisory—risk flags and suggested review dates—not automatic status promotion. Human confirmation remains required to mark contractually served.

**Consequences:** UI shows deeming assessments separately from factual delivery state. Wrong deeming logic cannot silently close notice obligations.
