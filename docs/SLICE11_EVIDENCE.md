# Slice 11 evidence honesty

## Gap analysis (pre-implementation)

| Area | Slice 10 state | Slice 11 gap |
|------|----------------|--------------|
| Cloud IaC | Empty/placeholder terraform | Real AWS Terraform package |
| Secrets | `env://` only | AWS Secrets Manager `sm://` adapter |
| Digests | Scaffolding allowed | `REQUIRE_REAL_DIGESTS=true` for cloud |
| Deployment approval | Types + unit tests | Bind SHA/digests; protected GH Environment |
| sharp | `UPSTREAM_BLOCKED` | Gate real deploy until human `PILOT_APPROVED_EXCEPTION` |
| Smoke/restore | CI/MinIO | Cloud scripts + reports; live NOT RUN without AWS |

## Implemented (repository)

- AWS pilot Terraform (ECS/Fargate, RDS, Redis, S3, ALB, ECR, Secrets Manager, alarms, budgets)
- Network security static analysis
- Cloud pilot IaC workflow (push) — static only
- Cloud pilot deploy / destroy workflows (manual, protected) — fail closed without sharp decision + AWS identity
- Release manifest digest wiring from image/SBOM/vuln evidence
- AWS Secrets Manager reference helpers + PILOT fake-secret rejection
- Cost estimate, drift static check, smoke/restore report scaffolds
- Cloud security review checklist + ADRs 130–135

## Labels

| Claim | Reality |
|-------|---------|
| Real cloud infrastructure exists | **NOT RUN** without AWS credentials/account |
| Terraform apply | **NOT RUN** |
| Cloud smoke / restore / alerts / rollback | **NOT RUN** |
| Synthetic CI / IaC verification | **YES** via Cloud pilot IaC workflow |
| Real providers | **DISABLED** |
| Customer data | **NONE** |
| Slice 11 fully verified | **NO** until real cloud apply + evidence |

## Sharp decision

`EXC-2026-005` remains `UPSTREAM_BLOCKED` / `pilotDecisionStatus: PENDING`.
Real deploy workflow fails closed until a human sets `PILOT_APPROVED_EXCEPTION` with full approval metadata — **not auto-set**.
