# ADR-058 — Suggestion rule-candidate matching

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** After detection, reviewers benefit from proposed links to notice rules, but matching against draft or superseded rules would bypass approved configuration (ADR-037) and invite auto-applicability.

**Decision:** Rule-candidate matching for event suggestions may reference only `ApprovedNoticeRuleSnapshot` rows from the project’s **active** approved configuration revision. Matches are advisory (`CANDIDATE`) until a human confirms applicability (`HUMAN_CONFIRMED` + APPLICABLE per ADR-040). Detection must not mark applicability, create `DeadlineCalculation`s, or treat draft `NoticeRule` ids as executable. If no active approved configuration exists, matching yields no candidates (or explicit incomplete), never invented rules.

**Consequences:** Detection stays upstream of Slice 4 gates. Accepting a suggestion still requires separate applicability confirmation before deadline calculation. Stale configuration changes do not rewrite historical advisory matches without a new assessment.
