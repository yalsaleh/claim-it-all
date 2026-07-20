# ADR-040 — Rule applicability assessment

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** `EventRuleAssessment` links a ProjectEvent to an `ApprovedNoticeRuleSnapshot`. Deterministic ranking may propose CANDIDATE matches; only HUMAN_CONFIRMED with applicability APPLICABLE may create deadline calculations. System never auto-marks applicability.
