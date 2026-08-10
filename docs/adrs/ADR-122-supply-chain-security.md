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
2. CI workflow `dependency-security` runs SBOM, license inventory, secret scan, and
   `pnpm security:audit` (advisory capture + owned expiring exception register)
3. Critical/high findings must be fixed or have an explicit owned, expiring exception
   keyed by advisory ID + package + package version + dependency path
   (`security/vulnerability-exceptions.json`), with expiry/staleness/unused gates
4. Expired, malformed, or mismatched exceptions fail CI; audit reports remain downloadable
5. Pin CI container images (tags today; digests as follow-up per [CI.md](../CI.md))
6. Review new privileged dependencies affecting auth, crypto, parsers, or connectors
7. Prefer disabling or vetting risky install scripts in restricted pipelines where the
   package manager allows

## Consequences

- Mode A evidence of scanning exists even without production deploy
- Complements deployment hardening (ADR-123)
- Does not replace secure coding or threat modeling for application logic
- Unconditional `exit 0` audit scripts are rejected — policy evaluation is the gate
## Alternatives considered

- Trusting floating `@latest` tags in CI — rejected.
- Manual occasional `npm audit` only — rejected; must be a workflow.
- Making every advisory fatal without reachability assessment — rejected; use owned exceptions.
- Full SLSA L3 provenance for every package — deferred; scanning + pinning first.

## Related

- Workflow `dependency-security` in [CI.md](../CI.md)
- [SLICE9B_EVIDENCE.md](../SLICE9B_EVIDENCE.md)
- ADR-123 deployment hardening
