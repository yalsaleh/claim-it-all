# ADR-033 — Human review and approval

## Status
Accepted (Slice 3)

## Context
Machine-suggested clauses, obligations, and notice rules must not become operative contract configuration without explicit human confirmation (ADR-007 alignment).

## Decision
- Review statuses on clauses, obligations, notice rules, relationships, and related entities start as `MACHINE_SUGGESTED` / `REVIEW_REQUIRED`.
- `ReviewDecision` records approve / reject / request-changes style actions with actor, entity type/id, before/after state, optional rationale and evidence.
- Configuration revision approval is a distinct gate: package structure may be partially approved, but **active approved configuration** requires an approved revision.
- No path auto-approves AI suggestions or activates unreviewed rules.
- Contact points and notice recipients never imply outbound send.

## Consequences
- Auditability of who confirmed what, against which evidence.
- Partial approval is visible (`PARTIALLY_APPROVED`) without pretending full readiness for entitlement engines.
