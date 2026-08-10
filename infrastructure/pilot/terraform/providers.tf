provider "aws" {
  region = var.aws_region

  # Never hardcode credentials. Use ambient auth (env, shared config, SSO, or CI OIDC).
  # aws_account_id is a variable with an empty default — set in local/private tfvars only.
  allowed_account_ids = var.aws_account_id != "" ? [var.aws_account_id] : null

  default_tags {
    tags = local.common_tags
  }
}
