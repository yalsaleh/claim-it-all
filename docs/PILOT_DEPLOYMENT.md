# Pilot deployment (architecture)

Honesty label: **architecture + rehearsal scaffolding**. This document does **not**
claim a real customer pilot deploy, cloud cutover, or live provider enablement.

## Architecture (target pilot)

```
[Edge TLS / Caddy] -> [Web (Next.js, non-root)] -> [Postgres + Redis + Objects + DI]
                              |
                              +-> workers (ARQ / outbox) behind kill switches
```

- Environment class: `CONTRACTRADAR_ENV=PILOT`
- Fake providers forbidden; AI / real connectors / notice delivery **OFF by default**
- Secrets via references (see `.env.pilot.example`) — never committed
- Templates: `infrastructure/pilot/`

## TLS / edge

- Terminate TLS at edge (`CADDYFILE.example`)
- HSTS and hardened headers assumed
- No public exposure of internal DI admin or migrate endpoints

## Release model

- Immutable image digests only (`sha256:…`); tag `latest` rejected
- Release manifest schema in `@contractradar/platform` `release-manifest`
- Generator: `pnpm pilot:release-manifest` → `artifacts/pilot-readiness/release-manifest.json`
- States: DRAFT → CANDIDATE → APPROVED → DEPLOYING → DEPLOYED (or ROLLED_BACK / REJECTED)

## Approval model

- Deployment requires a validated `DeploymentApproval` (`APPROVED`, unexpired, matching `releaseId`)
- Types/validation: `@contractradar/platform` `deployment-approval`
- Security review checklist: [PILOT_SECURITY_REVIEW.md](./PILOT_SECURITY_REVIEW.md)
- Vulnerability burndown: [security/VULNERABILITY_BURNDOWN.md](./security/VULNERABILITY_BURNDOWN.md)

## Operator commands (local / CI synthetic)

```bash
pnpm platform:ready
PILOT_PREFLIGHT_SYNTHETIC=true pnpm pilot:preflight
pnpm pilot:tenant:create && pnpm pilot:tenant:validate
pnpm pilot:release-manifest
bash scripts/pilot/deployment-rehearsal.sh
pnpm gh  # prefers system gh, then .tools/gh
```

## What this does **not** do

- Deploy to a real cloud account
- Send real notices or enable live commercial AI
- Waive non-waivable readiness controls
- Replace production change management
