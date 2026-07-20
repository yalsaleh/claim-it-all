# ADR-037 — Approved notice-rule snapshot activation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Slice 3 stored `NoticeRule.reviewStatus` and package `ContractConfigurationRevision` approval independently. Entity-level APPROVED did not mean executable.

**Decision:** On configuration revision approval, copy executable notice-rule fields into immutable `ApprovedNoticeRuleSnapshot` rows bound to that revision. Only snapshots from the active approved revision may feed the deadline engine. Later edits to draft `NoticeRule` rows do not alter snapshots or prior calculations.

**Consequences:** Approval must create snapshots; `getApprovedConfiguration` exposes snapshots for the active revision; Slice 4 engines reject bare `NoticeRule` IDs.
