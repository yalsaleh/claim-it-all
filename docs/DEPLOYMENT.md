# Deployment (Slice 9)

Slice 9 documents **hardening gates** for a future controlled pilot. It does **not** perform
or claim a real cloud/on-prem deployment.

## Preconditions

- Environment class is `STAGING`, `PILOT`, or `PRODUCTION` (ADR-103)
- `pnpm production:validate` passes (ADR-104)
- Fake / local-capture providers disabled in PILOT/PRODUCTION
- Migrate and runtime DB roles separated
- Backup + restore evidence current (ADR-113/114)
- Pilot checklist `canActivate=true` for PILOT (ADR-119)
- Supply-chain scan clean for known criticals (ADR-122)

## Hardening bar (ADR-123)

- Non-root containers; secrets injected via references — not baked into images
- Postgres / Redis / object storage not publicly reachable
- Document-intelligence authenticated (ADR-026)
- Readiness ≠ liveness (ADR-112)
- Break-glass out-of-band only — **not in product UI** (ADR-108)

## CI evidence

Workflow `production-readiness` aggregates validation and checklist artifacts. See [CI.md](./CI.md).

## Explicit non-goals

Real provider traffic, multi-region failover, and productized break-glass.
