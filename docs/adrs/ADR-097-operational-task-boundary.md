# ADR-097 — Operational task boundary

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Connectors and schedulers can create work for humans; that work must not blur into legal confirmation or dispatch.

**Decision:** `OperationalTask` covers actionable operator items—review sync error, reauthorize connector, acknowledge alert—with explicit non-goals: tasks cannot approve notice drafts, confirm project events, set contractual service, or activate deadlines. Task completion records operator acknowledgment only, not legal fact. Sync/scheduler code may create tasks and alerts; it may not write to entitlement, deadline, or dispatch domains.

**Consequences:** Clear separation of ops queue vs review queue. UI labels operational vs legal workflows distinctly. FORCE RLS on task tables.
