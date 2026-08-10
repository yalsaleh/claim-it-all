# Pilot cost controls

## Guardrails

- AWS Budgets alarm (Terraform `monitoring.tf`)
- ECS desired-count caps (no unbounded autoscaling)
- RDS/Redis fixed small instance classes for pilot
- S3 lifecycle on documents/backups
- CloudWatch log retention (14 days default)
- NAT Gateway count fixed at 2 AZs (dominant cost driver)

## Estimate

```bash
pnpm cloud:cost-estimate
```

Produces `artifacts/cloud-pilot/pilot-cost-estimate.json` (order-of-magnitude only).
