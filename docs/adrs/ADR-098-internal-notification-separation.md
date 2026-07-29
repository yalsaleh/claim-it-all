# ADR-098 — Internal notification separation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** `NotificationIntent` (ADR-046) and new internal channels must remain strictly separate from contractual notice dispatch (ADR-074, ADR-086).

**Decision:** `InternalNotification` delivers in-app or email digests to project/tenant members about operational and advisory conditions. `NotificationIntent` remains for internal deadline-warning records only. Neither type may enqueue notice dispatch, mutate dispatch state, or be presented as contractual service. Contractual notices flow only through approved drafts, export bundles, authorization, and delivery adapters.

**Consequences:** Shared notification UI must tag internal vs legal domains. Cross-wiring is rejected at compile/API boundaries. FORCE RLS on internal notification tables.
