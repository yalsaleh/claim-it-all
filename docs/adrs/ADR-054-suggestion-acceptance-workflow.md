# ADR-054 — Suggestion acceptance workflow

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Reviewers need a clear path from `PENDING_REVIEW` suggestions to actionable project facts without implying that acceptance finishes rule applicability or deadline activation.

**Decision:** Human accept of a `ProjectEventSuggestion` creates (or links to) a `ProjectEvent` transactionally within the same tenant/project, copying evidence links and leaving date suggestions unverified until separately verified. Acceptance does **not** confirm rule applicability (`EventRuleAssessment` remains CANDIDATE until HUMAN_CONFIRMED per ADR-040) and does **not** activate or calculate deadlines. Reject and needs-information transitions are audited; suggestions are not overwritten in place by later scans (ADR-056).

**Consequences:** Slice 4 deadline APIs remain the sole path to calculation after confirmed events, verified dates, and confirmed applicability. UI must show accept ≠ deadline ready. Capabilities for accept are server-enforced and audited.
