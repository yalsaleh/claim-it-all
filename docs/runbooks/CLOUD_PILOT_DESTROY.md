# Runbook — Destroy synthetic AWS pilot infrastructure

## Scope

Destroys **only** ContractRadar synthetic/internal pilot resources in the approved AWS account.
Does **not** support production or customer environments.

## Preconditions

1. Backup confirmation recorded (RDS snapshot + S3 versioning status)
2. Typed confirmation `SYNTHETIC-PILOT-DESTROY`
3. Exact 12-digit AWS account ID match
4. Protected GitHub Environment `pilot-cloud-destroy` approval
5. No real customer tenants present

## Preferred procedure (operator)

```bash
cd infrastructure/pilot/terraform
terraform init
terraform plan -destroy -var-file=environments/pilot/terraform.tfvars
# Human review of plan resource list — reject any unexpected account/name prefix
terraform destroy -var-file=environments/pilot/terraform.tfvars
```

## Automation

Workflow `Cloud pilot destroy` is manual/protected and currently fails closed without AWS identity.
It must never use wildcard account deletion.
