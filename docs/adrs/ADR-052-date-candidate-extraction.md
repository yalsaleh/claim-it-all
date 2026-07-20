# ADR-052 — Date-candidate extraction

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Correspondence often contains absolute and relative date language. Treating extracted candidates as verified trigger dates would bypass ADR-039 precision and verification gates and feed invented or ambiguous dates into the deadline engine.

**Decision:** Represent detection date proposals as `ProjectEventDateSuggestion` rows — unverified candidates with type, precision, source span, and epistemic status. They never become `ProjectEventDate` VERIFIED rows without human verification. Relative dates (e.g., “within 14 days of receipt”) may be proposed only when a reliable source timestamp (document version metadata or explicitly extracted absolute anchor) is available; otherwise mark missing/incomplete and do not invent an absolute calendar date.

**Consequences:** Acceptance of an event suggestion does not auto-verify dates. Deterministic calculation still requires VERIFIED EXACT_DATE / EXACT_DATETIME per ADR-039. Relative-only suggestions stay blocked for contractual deadline math until resolved.
