# ADR-070 — Controlled exceptions

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Some operational gaps are intentionally accepted without pretending requirements vanished.

**Decision:** NoticeControlledException records issue, risk, rationale, approver, and optional expiry. Non-waivable blockers include missing verified event, missing approved snapshot, missing required verified deadline, cross-project evidence, invented recipient/clause, unauthorized approver.

**Consequences:** Exceptions are auditable and never rewrite source facts.
