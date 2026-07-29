# ADR-061 — Evidence completeness assessment

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Slice 5 detection gaps do not cover notice-content evidence packs.

**Decision:** Model NoticeEvidenceRequirement, NoticeEvidenceLink, and EvidenceCompletenessAssessment with mandatory/satisfaction statuses. Contractually mandatory unresolved items block approval unless a controlled exception is recorded by an authorized approver.

**Consequences:** Reviewers see explicit gaps; waivers never erase contractual requirements.
