# ADR-130 — AWS pilot cloud architecture

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-08-09 |

## Context

Slice 9/10 established pilot readiness evidence and deployment hardening without
claiming a real cloud deploy. Slice 11 introduces a **conservative AWS PILOT**
infrastructure-as-code scaffold so operators can plan a controlled environment
with least-privilege networking, secret references, and cost guardrails.

Constraints from prior ADRs still apply:

- No autonomous legal state mutation (ADR-102)
- Secret **references** only in git / config (ADR-105)
- Deployment hardening checklist (ADR-123)
- Pilot readiness evidence remains non-waivable (ADR-119)

## Decision

Adopt a single-root Terraform module under
`infrastructure/pilot/terraform/` for a pilot-sized AWS topology:

1. **Network** — VPC with public + private subnets across 2 AZs; NAT for private egress
2. **Edge** — Application Load Balancer with HTTPS (ACM certificate ARN variable) and HTTP→HTTPS redirect; **only the web service** is publicly reachable via the ALB
3. **Compute** — ECS Fargate services: `web`, `document-intelligence`, `arq-worker`,
   `outbox-dispatcher`, `connector-worker`, `delivery-worker`, `scheduler`, `clamav`
4. **ClamAV** — private ECS service with service discovery; **no public load balancer**
5. **Workers** — desired count may be `1`; no public ports; private subnets only
6. **Data** — RDS PostgreSQL 16 (private, encrypted, backups, not publicly accessible);
   ElastiCache Redis (private, encryption at rest and in transit)
7. **Object storage** — private S3 buckets (documents + backups) with block public access,
   SSE, and versioning
8. **Secrets** — Secrets Manager secret containers / ARNs only; values populated out-of-band
9. **Images** — ECR repositories for web and document-intelligence (immutable tags)
10. **Observability / cost** — CloudWatch log groups + basic alarms; AWS Budgets alarm;
    cost allocation tags (`contractradar-pilot-*` naming)

### Safety defaults

- `enable_deployment` defaults to **`false`** (ECS desired counts = 0)
- Enabling deployment requires `deployment_approval_token = "I-APPROVE-PILOT-APPLY"`
- **`terraform apply` requires human approval** and is not performed by agents or CI by default
- Account IDs and certificate ARNs are variables with empty defaults — never invent credentials
- AWS provider `~> 5.0`; default region is a variable

### Validation scripts

- `scripts/cloud/terraform-validate.sh` — `fmt -check` + `validate` (native or Docker); never apply
- `scripts/cloud/network-security-check.sh` — static analysis that **fails** if RDS/Redis
  security groups allow `0.0.0.0/0` on ingress; writes
  `artifacts/cloud/network-security-report.json`

## Consequences

- Operators can `plan` the pilot stack safely with defaults
- Public exposure is limited to ALB 80/443; data plane remains private
- Real secret material stays out of git; ADR-105 reference schemes remain the product contract
- Cost visibility via tags + Budgets reduces silent pilot spend
- This ADR does **not** authorize production multi-region HA, customer go-live, or
  unattended apply pipelines

## Explicit non-goals

- Multi-account AWS Organizations landing zone
- Kubernetes / EKS
- Autonomous `terraform apply` in CI
- Storing real credentials, private keys, or database passwords in the repository
