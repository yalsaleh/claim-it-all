# ADR-028 — Clause source text vs normalized text

## Status
Accepted (Slice 3)

## Context
Extraction and OCR produce imperfect clause text. Reviewers need corrections without losing custody of what was taken from the document version.

## Decision
- `ContractClause.sourceText` is the immutable extract from a specific `DocumentVersion` (checksummed). Once written, it is not overwritten.
- Optional `normalizedText` may hold whitespace/numbering cleanup for search and display; it is not a substitute for source custody.
- Substantive corrections use `ClauseTextRevision` (draft → pending approval → approved), never silent mutation of `sourceText`.
- Evidence locators (`evidenceSegmentId` / `evidenceLocator`) remain required links back to page/span provenance where available.

## Consequences
- Auditors can always compare machine extract vs human revision.
- Downstream rules must cite clause identity + evidence; normalized text alone is insufficient for legal reliance.
