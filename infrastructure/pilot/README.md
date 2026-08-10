# Pilot infrastructure templates (synthetic)

These files are **templates** for a controlled pilot environment. They do not
deploy to a real cloud account and must not be filled with production secrets.

## Contents

| File | Purpose |
| --- | --- |
| `compose.pilot.synthetic.yml` | Optional local/synthetic Compose topology |
| `CADDYFILE.example` | TLS / reverse-proxy assumptions for pilot edge |
| `terraform/` | AWS PILOT Terraform (Slice 11) — plan-safe; apply requires human approval |

## Rules

- No real credentials in this directory
- AI, real connectors, and notice delivery remain OFF by default (see `.env.pilot.example`)
- Prefer secret **references** (`${PILOT_*_SECRET_REF}`) resolved outside git
- Image tags must be immutable digests at go-live; never deploy `latest`

## Related docs

- [docs/PILOT_DEPLOYMENT.md](../../docs/PILOT_DEPLOYMENT.md)
- [docs/PILOT_SECURITY_REVIEW.md](../../docs/PILOT_SECURITY_REVIEW.md)
- [docs/security/CLOUD_PILOT_SECURITY_REVIEW.md](../../docs/security/CLOUD_PILOT_SECURITY_REVIEW.md)
- [docs/SLICE11_EVIDENCE.md](../../docs/SLICE11_EVIDENCE.md)
- [docs/adrs/ADR-130-aws-pilot-cloud-architecture.md](../../docs/adrs/ADR-130-aws-pilot-cloud-architecture.md)
- [docs/security/VULNERABILITY_BURNDOWN.md](../../docs/security/VULNERABILITY_BURNDOWN.md)
- [docs/runbooks/CLOUD_PILOT_DESTROY.md](../../docs/runbooks/CLOUD_PILOT_DESTROY.md)
