# ADR-043 — Project calendar revision model

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Decision:** Project-scoped `ProjectCalendar` with immutable `ProjectCalendarRevision` (working week, weekends, holidays, exceptions). No hardcoded GCC country calendars in business logic. Slice 3 package `CalendarRule` remains contract-sourced; project calendars are the execution input for deadlines (may be seeded from contract rules later).
