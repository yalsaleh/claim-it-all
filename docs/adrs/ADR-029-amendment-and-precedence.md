# ADR-029 — Amendment and precedence

## Status
Accepted (Slice 3)

## Context
Amended GCC/FIDIC packages create conflicts between base conditions, particular conditions, and later instruments. Free-text “amendment notes” are insufficient for review or later engines.

## Decision
- Amendments and related instruments are first-class `ContractDocument` rows (typed, e.g. `AMENDMENT`, `ADDENDUM`, `PARTICULAR_CONDITIONS`).
- Document-to-document links use `ContractDocumentRelationship` (`AMENDS`, `REPLACES`, `OVERRIDES`, …) with confirmation status.
- Ordered interpretation uses `ContractPrecedenceRule` (rank, optional document/type/scope, evidence, approval fields).
- Machine suggestions start as `MACHINE_SUGGESTED` / `REVIEW_REQUIRED`; only human-confirmed precedence may drive approved configuration.

## Consequences
- Conflicts surface as configuration issues (`CONFLICTING_AMENDMENT`) rather than silent last-write-wins.
- Precedence is versioned with configuration revisions; stale ranks cannot silently remain active after supersession.
