# ADR-076 — Send authorization

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Contractual notice dispatch must never fire from background jobs, AI suggestions, or stale UI state.

**Decision:** Every dispatch requires explicit human authorization recorded before the first attempt: authorized actor, timestamp, target snapshot, and channel intent. A separate explicit send action executes dispatch; authorization alone does not transmit. Capabilities gate both steps; optional separation-of-duty may split authorizer and sender.

**Consequences:** Missing or expired authorization blocks dispatch. Audit logs capture authorize and send as distinct events.
