# ADR-062 — Reviewer questions

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Missing facts must be collected as structured questions, not free-form chat.

**Decision:** NoticeReviewQuestion tracks category, answer type, evidence, verification, and whether an answer became an approved NoticeFact. Unverified answers never enter approved external notice language.

**Consequences:** Evidence requests are auditable and assignable.
