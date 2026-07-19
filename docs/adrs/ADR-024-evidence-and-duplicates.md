# ADR-024 — Evidence locators, extraction artifacts, duplicates

## Status
Accepted (Slice 2)

## Decision
- Logical record: `SourceDocument` (renamed from earlier `Document` sketch for custody clarity)
- Immutable bytes: `DocumentVersion`
- Derived outputs: `ExtractedArtifact` + generalized `EvidenceSegment` with JSON `locator`
- Shared `EvidenceReference` in `@contractradar/shared` for future findings
- Exact SHA-256 duplicates are detected within tenant+project only; never auto-destroyed; `DUPLICATE_CONTENT_OF` relationship when linked
- Embedded text and OCR text are distinct evidence sources; OCR providers are not called in Slice 2
