# `packages/contract-rules`

Deterministic helpers for obligation-rule evaluation and deadline calculation.

## Status

Placeholder until Phase 1 (Epic D). This package must be heavily unit-tested — binding date math does not belong in LLM prompts.

## Planned contents

- Calendar-day / working-day calculators
- Jurisdiction calendar interfaces (pluggable holiday sets)
- Pure functions: `(rule, eventDates, calendar) → DeadlineCalculation`
- Explicit `incomplete_inputs` results when awareness/event dates are missing

No I/O, no Prisma, no AI SDKs.
