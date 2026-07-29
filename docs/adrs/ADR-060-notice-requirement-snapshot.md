# ADR-060 — Notice requirement snapshot

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Mutable NoticeRule and obligation recipient rows must not drive drafting after a package is created.

**Decision:** Create immutable NoticeRequirementSnapshot from the ApprovedNoticeRuleSnapshot used for the deadline, capturing content, recipients, delivery methods, timing, reservations, and source clause/evidence references. Configuration changes require a new package or superseding package.

**Consequences:** Drafting and validation bind to the snapshot, never live NoticeRule rows.
