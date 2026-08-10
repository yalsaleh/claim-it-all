variable "aws_region" {
  type        = string
  description = "Default AWS region for the pilot stack."
  default     = "eu-west-2"
}

variable "aws_account_id" {
  type        = string
  description = "Optional AWS account ID guard for the provider. Leave empty in git; set privately when applying."
  default     = ""
}

variable "enable_deployment" {
  type        = bool
  description = "When false (default), ECS desired counts stay at 0 for safe plans. Set true only with human approval."
  default     = false
}

variable "deployment_approval_token" {
  type        = string
  description = "Must equal I-APPROVE-PILOT-APPLY when enable_deployment is true. Not a secret — an explicit human-approval marker."
  default     = ""
  sensitive   = false
}

variable "certificate_arn" {
  type        = string
  description = "ACM certificate ARN for the ALB HTTPS listener. Required before a real edge deploy."
  default     = ""
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR for the pilot network."
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDRs (one per AZ)."
  default     = ["10.40.0.0/24", "10.40.1.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDRs (one per AZ)."
  default     = ["10.40.10.0/24", "10.40.11.0/24"]
}

variable "availability_zones" {
  type        = list(string)
  description = "Two AZs for public/private subnet pairs. Empty uses the first two AZs in the region."
  default     = []
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class (pilot-sized)."
  default     = "db.t4g.medium"
}

variable "db_allocated_storage_gb" {
  type        = number
  description = "Initial RDS allocated storage (GiB)."
  default     = 50
}

variable "db_backup_retention_days" {
  type        = number
  description = "RDS automated backup retention."
  default     = 7
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type (pilot-sized)."
  default     = "cache.t4g.micro"
}

variable "web_image" {
  type        = string
  description = "Container image for the web service (ECR URI + immutable tag/digest). Placeholder only in git."
  default     = ""
}

variable "document_intelligence_image" {
  type        = string
  description = "Container image for document-intelligence and DI-related workers. Placeholder only in git."
  default     = ""
}

variable "clamav_image" {
  type        = string
  description = "ClamAV container image (private service, no public LB)."
  default     = "clamav/clamav:1.4"
}

variable "worker_desired_count" {
  type        = number
  description = "Desired count for worker/private services when enable_deployment is true."
  default     = 1
}

variable "web_desired_count" {
  type        = number
  description = "Desired count for the web service when enable_deployment is true."
  default     = 1
}

variable "web_container_port" {
  type        = number
  description = "Container port for the web service behind the ALB."
  default     = 3000
}

variable "di_container_port" {
  type        = number
  description = "Container port for document-intelligence (private)."
  default     = 8000
}

variable "clamav_port" {
  type        = number
  description = "ClamAV clamd port (private only)."
  default     = 3310
}

variable "budget_limit_usd" {
  type        = number
  description = "Monthly AWS Budgets limit (USD) for the pilot cost alarm."
  default     = 500
}

variable "budget_alert_email" {
  type        = string
  description = "Email for budget threshold notifications. Leave empty to skip subscriber (alarm still created)."
  default     = ""
}

variable "cost_center" {
  type        = string
  description = "Cost allocation tag value."
  default     = "contractradar-pilot"
}

variable "alarm_actions" {
  type        = list(string)
  description = "Optional SNS topic ARNs for CloudWatch alarms. Empty = alarm without actions (plan-safe)."
  default     = []
}

variable "documents_bucket_name" {
  type        = string
  description = "Optional override for the private documents bucket name. Empty generates from name prefix + account/region."
  default     = ""
}

variable "backups_bucket_name" {
  type        = string
  description = "Optional override for the private backups bucket name. Empty generates from name prefix + account/region."
  default     = ""
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log group retention for pilot services."
  default     = 30
}
