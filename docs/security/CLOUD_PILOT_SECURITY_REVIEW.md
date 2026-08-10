# Cloud pilot security review (AWS)

Honesty: review of **IaC + design**. Live AWS posture is **NOT VERIFIED** until a real
account apply + probe completes. Slice 11B confirmed **AWS identity unavailable** in the
agent environment — real apply stopped.

| Item | Result | Notes |
|------|--------|-------|
| RLS / FORCE RLS | PASS | App migrations + readiness checks |
| Auth/session | PASS | Better Auth; secure cookies required in PILOT |
| Tenant admin / support access | PASS | Existing SoD controls |
| Secrets in git | PASS | Placeholders/refs only |
| Secrets Manager wiring | PASS (design) | `sm://` + ADR-105/ADR-131 |
| Terraform remote state | PASS (design) | Bootstrap module + S3/DynamoDB lock; **apply NOT RUN** |
| DB public access | PASS (IaC) | SG private only |
| Redis public access | PASS (IaC) | SG private only |
| S3 public access | PASS (IaC) | Block public access |
| ALB exposure | PASS (design) | 80/443 only |
| Workers public ingress | PASS (IaC) | No public ports |
| ClamAV private | PASS (IaC) | |
| Container non-root | PASS | UID 10001 |
| Mutable `latest` tags | PASS | Rejected in release manifest |
| Fake providers in PILOT | PASS | Config validation rejects |
| sharp runtime advisory | **PASS (remediated)** | `sharp@0.35.3` via pnpm override; EXC-2026-005 resolved |
| Real providers | NOT_APPLICABLE | Disabled |
| Customer data | NOT_APPLICABLE | Synthetic only |
| Live AWS network/RDS/Redis/S3 | **NOT RUN** | No AWS identity |

## Non-waivable blockers for real apply

1. No AWS identity / protected environment approval
2. Missing immutable ECR image digests
3. Public DB/Redis/S3 in plan
4. Fake providers enabled
5. Bootstrap remote state not yet applied in the target account
