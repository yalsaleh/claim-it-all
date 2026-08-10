output "state_bucket_name" {
  description = "S3 bucket for pilot Terraform state (name only — not a secret)"
  value       = aws_s3_bucket.tfstate.bucket
}

output "state_bucket_arn" {
  description = "S3 bucket ARN for IAM policy authoring"
  value       = aws_s3_bucket.tfstate.arn
}

output "lock_table_name" {
  description = "DynamoDB lock table name"
  value       = aws_dynamodb_table.tf_locks.name
}

output "aws_region" {
  value = local.region
}

output "aws_account_id" {
  value = local.account_id
}

output "backend_hcl_example" {
  description = "Copy into ../backend.hcl (gitignored). No secrets."
  value       = <<-EOT
    bucket         = "${aws_s3_bucket.tfstate.bucket}"
    key            = "pilot/terraform.tfstate"
    region         = "${local.region}"
    dynamodb_table = "${aws_dynamodb_table.tf_locks.name}"
    encrypt        = true
  EOT
}
