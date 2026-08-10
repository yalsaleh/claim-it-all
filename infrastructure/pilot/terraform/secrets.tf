# Secrets Manager — secret *containers* and ARN references only.
# Never commit secret values. Populate versions out-of-band after apply.

resource "aws_secretsmanager_secret" "app_config" {
  name                    = "${local.name_prefix}/app-config"
  description             = "Pilot app config secret references (DATABASE_URL, REDIS_URL, etc.). Values set out-of-band."
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-app-config"
  }
}

resource "aws_secretsmanager_secret" "connector_credentials" {
  name                    = "${local.name_prefix}/connector-credentials"
  description             = "Placeholder for connector provider secret references (sm://...). No plaintext in git."
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-connector-credentials"
  }
}

resource "aws_secretsmanager_secret" "delivery_credentials" {
  name                    = "${local.name_prefix}/delivery-credentials"
  description             = "Placeholder for delivery provider secret references (sm://...). No plaintext in git."
  recovery_window_in_days = 7

  tags = {
    Name = "${local.name_prefix}-delivery-credentials"
  }
}

# Optional placeholder version with non-secret metadata only (safe to plan).
# Real credentials must be written by operators / CI with OIDC — never via committed tfvars.
resource "aws_secretsmanager_secret_version" "app_config_placeholder" {
  secret_id = aws_secretsmanager_secret.app_config.id

  secret_string = jsonencode({
    _meta = {
      purpose            = "placeholder"
      populate_out_of_band = true
      references = {
        database_secret = "aws-managed-rds-master-user-secret"
        app_config_arn  = "set-after-apply"
      }
    }
    DATABASE_URL_SECRET_REF   = "sm://${local.name_prefix}/app-config#DATABASE_URL"
    REDIS_URL_SECRET_REF      = "sm://${local.name_prefix}/app-config#REDIS_URL"
    S3_DOCUMENTS_BUCKET       = local.documents_bucket
    S3_BACKUPS_BUCKET         = local.backups_bucket
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
