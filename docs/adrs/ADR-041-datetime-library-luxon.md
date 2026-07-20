# ADR-041 — Deterministic date/time library (Luxon)

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** JavaScript `Date` is insufficient for timezone-aware calendar and business-day math.

**Decision:** Use **Luxon** inside `@contractradar/contract-rules` for deadline arithmetic. Pure functions accept/return ISO strings; no DB/IO. Luxon provides immutable DateTime, IANA zones, and weekday helpers.

**Consequences:** Pin luxon in `packages/contract-rules`; engine remains free of Next.js/Prisma.
