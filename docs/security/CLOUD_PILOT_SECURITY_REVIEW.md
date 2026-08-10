# Cloud pilot security review (AWS)

Honesty: review of **IaC + design**. Live AWS posture is **NOT VERIFIED** until a real
account apply + probe completes.

| Item | Result | Notes |
|------|--------|-------|
| RLS / FORCE RLS | PASS | App migrations + readiness checks |
| Auth/session | PASS | Better Auth; secure cookies required in PILOT |
| Tenant admin / support access | PASS | Existing SoD controls |
| Secrets in git | PASS | Placeholders/refs only |
| Secrets Manager wiring | PASS (design) | `sm://` + ADR-105/ADR-131 |
| Terraform state secrets | EXCEPTION | Use remote state + encryption; not configured in CI |
| DB public access | PASS (IaC) | SG private only |
| Redis public access | PASS (IaC) | SG private only |
| S3 public access | PASS (IaC) | Block public access |
| ALB exposure | PASS (design) | 80/443 only |
| Workers public ingress | PASS (IaC) | No public ports |
| ClamAV private | PASS (IaC) | |
| Container non-root | PASS | UID 10001 |
| Mutable `latest` tags | PASS | Rejected in release manifest |
| Fake providers in PILOT | PASS | Config validation rejects |
| sharp runtime advisory | EXCEPTION | UPSTREAM_BLOCKED — deploy blocked without PILOT_APPROVED_EXCEPTION |
| Real providers | NOT_APPLICABLE | Disabled |
| Customer data | NOT_APPLICABLE | Synthetic only |

## Non-waivable blockers for real apply

1. No AWS identity / protected environment approval
2. sharp without `PILOT_APPROVED_EXCEPTION`
3. Missing immutable image digests
4. Public DB/Redis/S3 in plan
5. Fake providers enabled
