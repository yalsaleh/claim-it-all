provider "aws" {
  region = var.aws_region

  allowed_account_ids = var.aws_account_id != "" ? [var.aws_account_id] : null

  default_tags {
    tags = {
      Project     = "ContractRadar"
      Environment = "pilot"
      ManagedBy   = "terraform-bootstrap"
      Slice       = "11B"
      Purpose     = "terraform-remote-state"
    }
  }
}
