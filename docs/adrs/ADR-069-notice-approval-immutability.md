# ADR-069 — Notice approval and immutability

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Approved drafts must not be silently edited.

**Decision:** Approved NoticeDraftRevision is immutable; further edits require a new revision that supersedes. NoticeApprovalDecision is append-only. SoD may prevent the same user from preparing and approving when enabled.

**Consequences:** Matches ReviewDecision/AuditLog patterns from prior slices.
