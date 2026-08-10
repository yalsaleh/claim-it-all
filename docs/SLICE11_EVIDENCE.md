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

## CI evidence (final SHA)

Starting SHA: `42325e05bc09ed0ef9c13e353174db9e2a4460f5`  
Final SHA: `28867897bb69311d1b11877665619f4eaa854720`

| Workflow | Result |
|----------|--------|
| CI | success |
| Live ingestion | success on `3b2ad14` (path-filtered; fix commit only touched `scripts/pilot/`) |
| Migration rehearsal | success |
| Backup and restore | success |
| Production readiness | success |
| Dependency/security scan | success |
| Pilot release candidate | success |
| Pilot deployment rehearsal | success |
| Cloud pilot IaC | success |
| Cloud pilot deploy | **NOT RUN** (manual / no AWS identity) |

Slice 11 **not** fully verified: real cloud apply / smoke / restore remain NOT RUN.
