output "pilot_name_prefix" {
  description = "Naming prefix for pilot resources."
  value       = local.name_prefix
}

output "aws_region" {
  description = "Region used by the pilot stack."
  value       = local.region
}

output "vpc_id" {
  description = "Pilot VPC ID."
  value       = aws_vpc.pilot.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs (ALB)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs (ECS/RDS/Redis)."
  value       = aws_subnet.private[*].id
}

output "alb_dns_name" {
  description = "Public ALB DNS name (safe to share; not a secret)."
  value       = aws_lb.pilot.dns_name
}

output "alb_https_enabled" {
  description = "Whether the HTTPS listener is configured (certificate_arn set)."
  value       = var.certificate_arn != ""
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.pilot.name
}

output "ecs_service_names" {
  description = "ECS service names (desired counts are 0 unless enable_deployment=true)."
  value       = { for k, s in aws_ecs_service.services : k => s.name }
}

output "rds_endpoint_host" {
  description = "RDS hostname only (no credentials)."
  value       = aws_db_instance.pilot.address
}

output "rds_port" {
  description = "RDS port."
  value       = aws_db_instance.pilot.port
}

output "rds_master_user_secret_arn" {
  description = "ARN of the AWS-managed RDS master user secret (reference only)."
  value       = aws_db_instance.pilot.master_user_secret[0].secret_arn
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint hostname (no auth token)."
  value       = aws_elasticache_replication_group.pilot.primary_endpoint_address
}

output "documents_bucket" {
  description = "Private documents bucket name."
  value       = aws_s3_bucket.documents.bucket
}

output "backups_bucket" {
  description = "Private backups bucket name."
  value       = aws_s3_bucket.backups.bucket
}

output "ecr_web_repository_url" {
  description = "ECR repository URL for web images."
  value       = aws_ecr_repository.web.repository_url
}

output "ecr_document_intelligence_repository_url" {
  description = "ECR repository URL for document-intelligence images."
  value       = aws_ecr_repository.document_intelligence.repository_url
}

output "secrets_app_config_arn" {
  description = "Secrets Manager ARN for app config (populate out-of-band)."
  value       = aws_secretsmanager_secret.app_config.arn
}

output "service_discovery_namespace" {
  description = "Private DNS namespace for ECS service discovery."
  value       = aws_service_discovery_private_dns_namespace.pilot.name
}

output "enable_deployment" {
  description = "Whether workloads are enabled (must be human-approved)."
  value       = var.enable_deployment
}

output "redacted_endpoints_summary" {
  description = "Operator-safe endpoint summary without credentials or account secrets."
  value = {
    alb_dns                 = aws_lb.pilot.dns_name
    https_configured        = var.certificate_arn != ""
    rds_host                = aws_db_instance.pilot.address
    redis_host              = aws_elasticache_replication_group.pilot.primary_endpoint_address
    documents_bucket        = aws_s3_bucket.documents.bucket
    backups_bucket          = aws_s3_bucket.backups.bucket
    service_discovery       = aws_service_discovery_private_dns_namespace.pilot.name
    deployment_enabled      = var.enable_deployment
    note                    = "Credentials and secret values are never exported here."
  }
}
