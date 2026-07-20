# ADR-030 — Obligation model

## Status
Accepted (Slice 3)

## Context
Notice periods and related duties must be structured for review and (later) deterministic evaluation. Free-text clause prose alone is not machine-safe.

## Decision
- `ContractObligation` is the structured duty derived from a source `ContractClause`.
- Captures parties/roles, action/trigger/condition descriptions, timing expression, form/content/delivery requirements, and consequence text.
- Flags `isTimeBarredCandidate` / `isConditionPrecedentCandidate` are **candidates** until human review; they never auto-activate engines.
- Related rows: `ObligationTrigger`, `ObligationRecipient`, `ObligationEvidenceRequirement`.
- Separate `machineInterpretation` vs `humanApprovedInterpretation`; review status gates approval.
- Obligations may attach to a `ContractConfigurationRevision`; only approved revision contents are authoritative.

## Consequences
- Replaces the earlier sketch name `ObligationRule` with a richer obligation + notice-rule split.
- EntitlementEvent / project-event deadline evaluation remains out of Slice 3 (see ADR-036).
