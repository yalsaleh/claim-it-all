# ContractRadar pilot — AWS Terraform (Slice 11)

Conservative **PILOT** architecture on AWS. This is a single-root Terraform module
for a controlled pilot — not a multi-account landing zone.

## Remote state

Bootstrap first (separate local-state module): `bootstrap/`.
Then `terraform init -backend-config=backend.hcl` using `backend.hcl.example`.

Static check: `pnpm cloud:backend-security`.

## Human approval required

**Do not run `terraform apply` without documented human approval.**

| Control | Default | Meaning |
| --- | --- | --- |
| `enable_deployment` | `false` | ECS desired counts stay at `0`; safe to `plan` |
| `deployment_approval_token` | `""` | Must be `I-APPROVE-PILOT-APPLY` when enabling deployment |
| `certificate_arn` | `""` | Required for HTTPS when `enable_deployment=true` |

`terraform plan` with defaults is the supported CI/local validation path.
`terraform apply` against a real account is an operator action outside automated agents.

## Layout

```
infrastructure/pilot/terraform/
  versions.tf      # terraform + aws ~> 5.0; approval check
  providers.tf
  variables.tf
  main.tf          # locals (contractradar-pilot-*), AZ selection
  network.tf       # VPC, 2 AZ public/private, SGs
  alb.tf           # ALB, HTTP→HTTPS redirect, HTTPS listener
  data.tf          # RDS Postgres 16, Redis, S3
  ecr.tf           # web + document-intelligence repos
  secrets.tf       # Secrets Manager placeholders (no secret values)
  ecs.tf           # Fargate services + IAM least privilege
  monitoring.tf    # CloudWatch alarms + AWS Budgets
  outputs.tf       # redacted-safe endpoints
  environments/pilot/terraform.tfvars.example
```

## Architecture (summary)

- VPC with public + private subnets across **2 AZs**, NAT per AZ
- **ALB** public on 80/443; HTTP redirects to HTTPS; only **web** is target-registered
- **ECS Fargate**: web, document-intelligence, arq-worker, outbox-dispatcher,
  connector-worker, delivery-worker, scheduler, clamav
- ClamAV and all workers are **private** (no public LB ports)
- **RDS PostgreSQL 16** private, encrypted, backups, `publicly_accessible=false`,
  master password AWS-managed in Secrets Manager
- **ElastiCache Redis** private, encryption at rest + in transit
- **S3** documents + backups: block public access, SSE, versioning
- **Secrets Manager** secret containers / references only — never commit values
- **ECR** immutable-tag repos for web and DI
- **CloudWatch** log groups + basic alarms; **AWS Budgets** cost alarm
- Cost tags via provider `default_tags` (`Project`, `Environment`, `CostCenter`, `Slice`)

## Prerequisites

- Terraform `>= 1.5` (or Docker image `hashicorp/terraform:1.9`)
- AWS credentials via ambient auth only (SSO / env / CI OIDC) — **never** in git
- Optional: configure a remote state backend before any real apply

## Validate (no apply)

From the repository root:

```bash
./scripts/cloud/terraform-validate.sh
./scripts/cloud/network-security-check.sh
```

Or manually:

```bash
cd infrastructure/pilot/terraform
terraform init -backend=false
terraform fmt -check
terraform validate
```

## Apply path (operators only)

1. Copy `environments/pilot/terraform.tfvars.example` to a **private** `terraform.tfvars`
2. Set `aws_account_id`, `certificate_arn`, immutable image digests, budget email
3. Review `terraform plan`
4. Obtain human approval; set `enable_deployment=true` and
   `deployment_approval_token="I-APPROVE-PILOT-APPLY"`
5. Apply with an approved operator identity
6. Populate Secrets Manager versions out-of-band (ADR-105)

## Related

- [ADR-130 — AWS pilot cloud architecture](../../../docs/adrs/ADR-130-aws-pilot-cloud-architecture.md)
- [ADR-123 — Deployment hardening](../../../docs/adrs/ADR-123-deployment-hardening.md)
- [ADR-105 — Secret references](../../../docs/adrs/ADR-105-secret-references-rotation.md)
- Synthetic compose templates: `../README.md`
