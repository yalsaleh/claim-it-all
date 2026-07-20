# ADR-027 — Contract package model

## Status
Accepted (Slice 3)

## Context
A project’s governing instruments are rarely a single PDF. Base conditions, particular conditions, appendices, and amendments must be grouped so structure, precedence, and approved rules share one container.

## Decision
- `ContractPackage` is the project-scoped container for the governing agreement set.
- Statuses: `DRAFT` → `INGESTING` / `STRUCTURING` → `REVIEW_REQUIRED` → `PARTIALLY_APPROVED` → `APPROVED` (also `SUPERSEDED`, `ARCHIVED`).
- Package metadata includes form family/edition, governing law/jurisdiction, languages, and effective/commencement dates.
- `ContractDocument` rows bind ingested `SourceDocument` / `DocumentVersion` artifacts into the package with typed roles (agreement, GC/PC, amendment, etc.).
- Only an **approved** configuration revision may be treated as authoritative for downstream engines (when those engines exist).

## Consequences
- Clause, obligation, and notice-rule work is scoped under a package, not loose project files.
- Package `APPROVED` does not imply entitlement detection or deadline engines are live — those remain later slices.
