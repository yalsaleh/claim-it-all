# ADR-038 — Project-event factual model

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Deadline calculation needs human-confirmed project facts before applying contract rules. Automatic entitlement detection is deferred.

**Decision:** Introduce `ProjectEvent` as a manually created / human-confirmed factual record, separate from AI suggestions. Confirmation statuses distinguish UNCONFIRMED, CONFIRMED_FACT, and CONFIRMED_FOR_DEADLINE_ANALYSIS. “Claimable” is not an event status.

**Consequences:** Slice 4 APIs require confirmation before rule applicability and calculation; no automatic event creation from correspondence.
