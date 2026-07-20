# ADR-035 — Bilingual contract handling

## Status
Accepted (Slice 3)

## Context
GCC packages often mix Arabic and English across instruments or within a single document. Ignoring language conflicts produces false certainty.

## Decision
- Package and document language fields (`governingLanguage`, `secondaryLanguage`, per-document `language`) are first-class.
- Clauses carry a language tag; bilingual alignment corrections use `ClauseTextRevision` kind `BILINGUAL_ALIGNMENT` under review.
- Party names may store `nameEn` / `nameAr` where available.
- Conflicts between language versions are configuration issues (`BILINGUAL_CONFLICT`), not silent preference for the extraction language.
- Precedence may scope to `LANGUAGE_VERSION` when the contract so provides; otherwise unresolved bilingual conflict blocks confident approval of affected rules.

## Consequences
- Reviewers must resolve or explicitly defer bilingual conflicts before treating affected notice/obligation rules as approved.
- Aligns with ADR-011 without claiming automatic translation authority.
