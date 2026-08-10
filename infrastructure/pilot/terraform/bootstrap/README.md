# Bootstrap — Terraform remote state (pilot)

One-time, **separate** from the pilot root module. Creates private S3 state storage
and a DynamoDB lock table. Do **not** store bootstrap state in the pilot backend
it creates (chicken-and-egg).

## Procedure

1. Confirm AWS identity: `aws sts get-caller-identity` (record Account + Arn only).
2. Set private `terraform.tfvars` (never commit): `aws_account_id`, `aws_region`.
3. From this directory:
   ```bash
   terraform init -backend=false   # local state for bootstrap only
   terraform validate
   terraform plan
   # Human approval required
   terraform apply
   ```
4. Copy outputs into `../backend.hcl` (from `backend.hcl.example`).
5. In `infrastructure/pilot/terraform/`:
   ```bash
   terraform init -backend-config=backend.hcl
   terraform validate
   terraform plan -var-file=environments/pilot/terraform.tfvars
   ```
6. Obtain deployment approval, then apply with `enable_deployment=true` only when intended.

## Security

- Bucket: encryption (SSE-S3 or SSE-KMS), versioning, public access blocked
- Lock table: point-in-time recovery optional; encryption at rest
- IAM: operators use least-privilege roles; no long-lived keys in git
- Outputs: bucket/table names only — no secrets

## Honesty

Bootstrap **apply** requires a real AWS account. Without identity, only `terraform validate`
(static) is possible — see `scripts/cloud/terraform-backend-security.sh`.
