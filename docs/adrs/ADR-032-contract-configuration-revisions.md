# ADR-032 — Contract configuration revisions

## Status
Accepted (Slice 3)

## Context
Contract interpretation evolves as documents are linked and reviewers confirm structure. Downstream consumers must pin to an immutable approved snapshot, not a mutable draft register.

## Decision
- `ContractConfigurationRevision` is a versioned snapshot of structured interpretation for a package (`revisionNumber`, statuses: `DRAFT` → `IN_REVIEW` → `APPROVED` / `CHANGES_REQUESTED` / `WITHDRAWN` / `SUPERSEDED`).
- **Approved revisions are immutable.** Further edits create a new revision that may supersede the prior one.
- At most one revision may be `isActiveApproved` for a package; `ContractPackage.currentConfigurationRevisionId` points at the current pointer (may be draft during work).
- Precedence rules, defined terms, obligations, notice rules, and calendar rules may bind to a revision.
- `ContractConfigurationIssue` tracks blocking/ambiguous gaps against a revision.

## Consequences
- Stale approved configs cannot be silently edited; activation of a new revision is an explicit, audited transition.
- Engines (when built) must read the active approved revision only.
