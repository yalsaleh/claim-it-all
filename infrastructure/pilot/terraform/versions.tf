terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Partial S3 backend — configure via backend.hcl after bootstrap apply.
  # CI/static validation uses: terraform init -backend=false
  backend "s3" {}
}

# Human-approval gate: enable_deployment=true requires an explicit approval token.
# This keeps default plans/applies from starting workloads accidentally.
check "pilot_deployment_requires_human_approval" {
  assert {
    condition = (
      !var.enable_deployment ||
      var.deployment_approval_token == "I-APPROVE-PILOT-APPLY"
    )
    error_message = "enable_deployment=true requires deployment_approval_token=\"I-APPROVE-PILOT-APPLY\" and documented human approval. Do not apply without review."
  }
}
