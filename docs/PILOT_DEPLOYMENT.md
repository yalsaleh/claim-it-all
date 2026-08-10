# Pilot deployment

## Honesty labels

| Mode | Meaning |
|------|---------|
| CI synthetic pilot | GitHub Actions + local containers; no AWS account |
| Real cloud synthetic/internal pilot | AWS apply with synthetic tenants only (Slice 11 target) |
| Future customer pilot | Out of scope until provider integration approval |
| Future provider integration | Explicit next phase after Slice 11 |

## Architecture (ADR-130)

AWS: VPC → ALB (TLS) → ECS Fargate (web) + private workers/DI/ClamAV → RDS PostgreSQL + ElastiCache Redis + private S3 + Secrets Manager.

IaC: `infrastructure/pilot/terraform/` (`enable_deployment=false` by default).

## Operator commands

```bash
pnpm cloud:network-check
pnpm cloud:terraform-validate   # uses terraform or docker hashicorp/terraform
pnpm cloud:status               # never fabricates deploy success
pnpm production:validate:pilot
PILOT_PREFLIGHT_SYNTHETIC=true pnpm pilot:preflight
REQUIRE_REAL_DIGESTS=true pnpm pilot:release-manifest   # after image digests exist
```

## Cloud deploy workflow

- `Cloud pilot IaC` — push/PR static checks
- `Cloud pilot deploy` — **manual only**, protected `pilot-cloud` environment
  - typed confirmation `DEPLOY-SYNTHETIC-PILOT`
  - sharp must be `PILOT_APPROVED_EXCEPTION` (not auto-set)
  - AWS identity required; apply not silent

## What this does not do

- Connect real mailboxes/EDMS/SMTP/AI
- Onboard customers
- Auto-apply Terraform on push
- Waive FORCE RLS / SoD / approval controls
