# Pilot deployment

## Honesty labels

| Mode | Meaning |
|------|---------|
| CI synthetic pilot | GitHub Actions + local containers; no AWS account |
| Real cloud synthetic/internal pilot | AWS apply with synthetic tenants only (Slice 11 / 11B) |
| Future customer pilot | Out of scope until provider integration approval |
| Future provider integration | Explicit next phase after Slice 11 full verification |

## Architecture (ADR-130)

AWS: VPC → ALB (TLS) → ECS Fargate (web) + private workers/DI/ClamAV → RDS PostgreSQL + ElastiCache Redis + private S3 + Secrets Manager.

IaC: `infrastructure/pilot/terraform/` (`enable_deployment=false` by default).

## Remote state bootstrap (required before first apply)

```bash
# 1) Confirm identity (Account/Arn only)
aws sts get-caller-identity

# 2) Bootstrap state bucket + lock table (local state for bootstrap only)
cd infrastructure/pilot/terraform/bootstrap
terraform init -backend=false
terraform plan
# human approval
terraform apply

# 3) Write ../backend.hcl from terraform output backend_hcl_example
# 4) Initialize pilot root against remote state
cd ..
terraform init -backend-config=backend.hcl
```

See `infrastructure/pilot/terraform/bootstrap/README.md`.

## Operator commands

```bash
pnpm cloud:identity
pnpm cloud:backend-security
pnpm cloud:network-check
pnpm cloud:terraform-validate
pnpm cloud:status               # never fabricates deploy success
pnpm cloud:release-manifest     # fails closed without real digests
pnpm production:validate:pilot
PILOT_PREFLIGHT_SYNTHETIC=true pnpm pilot:preflight
```

## Sharp

`EXC-2026-005` was **remediated** in Slice 11B via `pnpm.overrides.sharp=0.35.3`.
No `PILOT_APPROVED_EXCEPTION` is required while the exception remains `resolved` and the advisory stays absent.

## Cloud deploy workflow

- `Cloud pilot IaC` — push/PR static checks
- `Cloud pilot deploy` — **manual only**, protected `pilot-cloud` environment
  - typed confirmation `DEPLOY-SYNTHETIC-PILOT`
  - AWS identity required
  - apply not silent / not on push

## Slice 11B status

Real AWS apply: **NOT RUN — AWS identity unavailable** in the current operator/agent environment.

## What this does not do

- Connect real mailboxes/EDMS/SMTP/AI
- Onboard customers
- Auto-apply Terraform on push
- Waive FORCE RLS / SoD / approval controls
