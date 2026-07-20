# ADR-031 — Notice rule structured representation

## Status
Accepted (Slice 3)

## Context
Contractual notice timing needs structured fields (duration, calendar basis, counting convention, recipients) for human confirmation and later deterministic math — without treating uncertain time bars as settled.

## Decision
- `NoticeRule` is a structured child of `ContractObligation` (one obligation may yield one or more notice rules).
- Structured fields include duration value/unit, calendar basis, counting convention, start/end rules, business-day adjustment, holiday calendar link, delivery vs preparation, continuing-event / particulars requirements, recipient and content requirements.
- `timeBarClassification` defaults to `UNCERTAIN`; overconfident promotion to express time-bar/condition precedent requires human approval and evidence.
- `ambiguityStatus` and `reviewStatus` make unresolved timing visible; ambiguous rules must not silently become active configuration.

## Consequences
- UI and APIs can show incomplete or uncertain timing without inventing deadlines.
- Slice 3 stores and validates structure; project-event deadline calculation is deferred (ADR-036).
