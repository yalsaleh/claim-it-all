# ADR-072 — Bilingual notice handling

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Arabic and English are first-class; machine translation is derived.

**Decision:** Packages support language/secondaryLanguage, governing-language designation, RTL/Arabic date/numeral options, and per-language review. Machine translation is not approved until reviewed. Export manifest identifies governing version and translation status.

**Consequences:** Synthetic bilingual fixtures cover CI.
