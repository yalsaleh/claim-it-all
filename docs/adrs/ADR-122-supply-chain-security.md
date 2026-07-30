# ADR-122 — Supply-chain security

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Dependency and base-image compromise is a primary risk before any real deploy. Slice 9
must institutionalize scanning and pinning without claiming a full SLSA attestation program
yet.

## Decision

1. Lockfiles committed; installs use `--frozen-lockfile` in CI and release paths
2. CI workflow `dependency-scan` runs advisory scanning (JS + Python as applicable) on
   PRs and main
3. Pin CI container images (tags today; digests as follow-up per [CI.md](../CI.md))
4. Review new privileged dependencies affecting auth, crypto, parsers, or connectors
5. Prefer disabling or vetting risky install scripts in restricted pipelines where the
   package manager allows
6. Treat critical advisories as merge blockers when the workflow is required by branch
   protection

## Consequences

- Mode A evidence of scanning exists even without production deploy
- Complements deployment hardening (ADR-123)
- Does not replace secure coding or threat modeling for application logic
## Alternatives considered

- Trusting floating `@latest` tags in CI — rejected.
- Manual occasional `npm audit` only — rejected; must be a workflow.
- Full SLSA L3 provenance for every package — deferred; scanning + pinning first.

## Related

- Workflow `dependency-scan` in [CI.md](../CI.md)
- ADR-123 deployment hardening
