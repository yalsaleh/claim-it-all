# ADR-048 — Event-detection suggestion model

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Slice 4 established `ProjectEvent` as a human-confirmed factual record (ADR-038). Automated detection from correspondence must not collapse that boundary by treating model or rule hits as project facts, entitlements, or deadlines.

**Decision:** Introduce `ProjectEventSuggestion` as a separate entity from `ProjectEvent`. Suggestions are never facts, entitlements, or deadlines. New suggestions start as `PENDING_REVIEW` and remain advisory until an authorized human explicitly accepts (or rejects) them. Detection outputs must carry epistemic labels (interpretation / assumption / missing) and evidence references; they do not create confirmed events, rule applicability, or tracked deadlines.

**Consequences:** Deadline and entitlement workflows consume only human-confirmed `ProjectEvent` rows. UI and APIs must distinguish suggestion queues from confirmed events. Acceptance is a separate, audited transition (ADR-054). Product confidence scores must not be presented as legal certainty.
