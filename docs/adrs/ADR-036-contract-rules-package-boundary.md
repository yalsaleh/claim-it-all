# ADR-036 — Contract-rules package boundary (Slice 3)

## Status
Accepted (Slice 3)

## Context
`packages/contract-rules` (and related shared types) must not grow into a premature entitlement/deadline engine while Slice 3 focuses on structure, validation, and human-approved configuration.

## Decision
- In Slice 3, the contract-rules boundary is limited to **validation and normalization** of structured contract configuration (schemas, enums, invariants, safe normalization of clause numbers/durations, revision consistency checks).
- **No project-event deadline calculation** in Slice 3: no entitlement-event date arithmetic, no contractual-vs-internal deadline engine against live project events, no “time-bar expired” product conclusions from package code alone.
- Notice-rule structured fields may be validated for completeness/consistency; computing due dates from project awareness/occurrence dates is deferred to a later slice (Epic D3 / deadline engine).
- Deterministic deadline math remains the intended long-term home (ADR-004) but is explicitly **out of scope** until structure + approval gates are in place.

## Consequences
- Slice 3 can land package/clause/obligation/notice-rule models and review without false “deadline engine complete” claims.
- D3 (deadline calculator) is deferred to the next slice after configuration approval paths exist.

## Follow-up (Slice 4)
ADR-037–047 supersede the deferral: `@contractradar/contract-rules` now exposes pure `calculateDeadline` against serializable approved-rule snapshots and calendar revisions. Validation/normalization from Slice 3 remains required before execution. AI event detection and entitlement conclusions stay out of scope.
