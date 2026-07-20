# ADR-055 — Detection feedback and evaluation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Improving detectors requires reviewer signal and regression harnesses, but synthetic scores are easily misread as legal accuracy or product certification.

**Decision:** Persist `ReviewerFeedback` as append-only records tied to suggestions/runs (accept, reject, false positive/negative labels, free-text rationale within size limits). Use feedback and fixture corpora for detector version evaluation. Synthetic benchmarks and fixture pass rates measure engineering regression only — they are **not** claims of legal accuracy, jurisdiction fitness, or entitlement correctness.

**Consequences:** Docs, dashboards, and release notes must not present benchmark percentages as legal verification. Feedback never auto-rewrites historical suggestions or confirmed events. Evaluation harnesses stay fixture-driven for Mode A / CI.
