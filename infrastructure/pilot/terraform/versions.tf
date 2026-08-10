terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend intentionally unset for the pilot scaffold.
  # Configure a remote state backend (S3 + DynamoDB lock) out-of-band before any apply.
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
