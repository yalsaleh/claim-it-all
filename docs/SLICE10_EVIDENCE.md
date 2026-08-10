# Slice 10 evidence honesty notes

## Scaffolding / synthetic only

- Pilot env template (`.env.pilot.example`) — placeholders and secret **refs** only
- Platform modules: pilot defaults, release manifest, deployment approval, burndown, monitoring
- Scripts under `scripts/pilot/` writing reports to `artifacts/pilot-readiness/`
- Workflows `pilot-release-candidate.yml` and `pilot-deployment-rehearsal.yml` — **no deploy**
- Infrastructure templates under `infrastructure/pilot/` — no real credentials
- Vulnerability burndown classes on exceptions (vitest/vite DEV_ONLY; sharp UPSTREAM_BLOCKED)

## Labels (do not overclaim)

| Claim | Reality |
| --- | --- |
| Platform readiness probe | Local TCP probes / CI services |
| Pilot preflight | Exception-register policy evaluation; synthetic mode for CI |
| Tenant create/validate | Synthetic JSON under artifacts |
| Release manifest | Candidate JSON; digests may be placeholders |
| Deployment rehearsal | Scripted checks + migrate when DB exists; NOT RUN otherwise |
| Cloud deployment | **No** |
| Real providers / notices / AI | **No** (defaults OFF) |
| Pilot go-live approval | **No** — requires security review + PILOT_APPROVED_EXCEPTION where noted |

## Related Slice 9B

See [SLICE9B_EVIDENCE.md](./SLICE9B_EVIDENCE.md) for container hardening, restore, and supply-chain evidence already established.
