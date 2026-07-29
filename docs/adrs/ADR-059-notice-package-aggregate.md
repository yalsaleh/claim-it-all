# ADR-059 — NoticePackage aggregate

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Verified deadlines and confirmed events need a top-level container for evidence completion, drafting, review, and export without implying delivery.

**Decision:** Introduce NoticePackage bound to one project, confirmed ProjectEvent, verified DeadlineCalculation, approved configuration revision, and ApprovedNoticeRuleSnapshot. Statuses include DRAFT through EXPORTED/ARCHIVED. Reserved SENT enum may exist but has no operational transition in Slice 6.

**Consequences:** All notice workflow entities hang off NoticePackage. Drafting cannot silently retarget when configuration or evidence changes.
