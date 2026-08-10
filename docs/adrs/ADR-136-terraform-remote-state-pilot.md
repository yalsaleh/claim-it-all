# ADR-136 — Terraform remote state for AWS pilot

## Status

Accepted (Slice 11B)

## Decision

Pilot Terraform state uses:

1. A **bootstrap** module (`infrastructure/pilot/terraform/bootstrap/`) applied with **local state** once
2. A private S3 bucket (encryption, versioning, public access blocked, TLS-only policy)
3. A DynamoDB lock table (encryption, PITR)
4. Pilot root module partial `backend "s3" {}` configured via gitignored `backend.hcl`

Bootstrap must never store its own state in the bucket it creates without a documented break-glass.

## Consequences

CI continues `terraform init -backend=false`. Real apply remains blocked without AWS identity + human approval.
