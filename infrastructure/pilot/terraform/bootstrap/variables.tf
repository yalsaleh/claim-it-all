variable "aws_region" {
  type        = string
  description = "AWS region for state bucket and lock table"
  default     = "us-east-1"
}

variable "aws_account_id" {
  type        = string
  description = "Expected 12-digit AWS account ID (required for apply)"
  default     = ""

  validation {
    condition     = var.aws_account_id == "" || can(regex("^\\d{12}$", var.aws_account_id))
    error_message = "aws_account_id must be empty or a 12-digit account id."
  }
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket for Terraform state. Leave empty to derive from account+region."
  default     = ""
}

variable "lock_table_name" {
  type        = string
  description = "DynamoDB table for Terraform state locking"
  default     = "contractradar-pilot-terraform-locks"
}
