data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix = "contractradar-pilot"

  azs = length(var.availability_zones) >= 2 ? slice(var.availability_zones, 0, 2) : slice(data.aws_availability_zones.available.names, 0, 2)

  account_id = var.aws_account_id != "" ? var.aws_account_id : data.aws_caller_identity.current.account_id
  region     = var.aws_region != "" ? var.aws_region : data.aws_region.current.name

  # Effective desired counts — zero unless explicitly enabled after human approval.
  web_desired     = var.enable_deployment ? var.web_desired_count : 0
  worker_desired  = var.enable_deployment ? var.worker_desired_count : 0
  clamav_desired  = var.enable_deployment ? 1 : 0
  di_desired      = var.enable_deployment ? 1 : 0

  documents_bucket = var.documents_bucket_name != "" ? var.documents_bucket_name : "${local.name_prefix}-documents-${local.account_id}-${local.region}"
  backups_bucket   = var.backups_bucket_name != "" ? var.backups_bucket_name : "${local.name_prefix}-backups-${local.account_id}-${local.region}"

  web_image = var.web_image != "" ? var.web_image : "${aws_ecr_repository.web.repository_url}:REPLACE_WITH_IMMUTABLE_DIGEST"
  di_image  = var.document_intelligence_image != "" ? var.document_intelligence_image : "${aws_ecr_repository.document_intelligence.repository_url}:REPLACE_WITH_IMMUTABLE_DIGEST"

  common_tags = {
    Project     = "ContractRadar"
    Environment = "pilot"
    ManagedBy   = "terraform"
    CostCenter  = var.cost_center
    Slice       = "11"
    NamePrefix  = local.name_prefix
  }

  ecs_services = {
    web = {
      cpu           = 512
      memory        = 1024
      desired_count = local.web_desired
      image         = local.web_image
      port          = var.web_container_port
      public_alb    = true
      command       = null
    }
    document-intelligence = {
      cpu           = 1024
      memory        = 2048
      desired_count = local.di_desired
      image         = local.di_image
      port          = var.di_container_port
      public_alb    = false
      command       = null
    }
    arq-worker = {
      cpu           = 512
      memory        = 1024
      desired_count = local.worker_desired
      image         = local.di_image
      port          = null
      public_alb    = false
      command       = ["arq", "document_intelligence.workers.WorkerSettings"]
    }
    outbox-dispatcher = {
      cpu           = 256
      memory        = 512
      desired_count = local.worker_desired
      image         = local.di_image
      port          = null
      public_alb    = false
      command       = ["python", "-m", "document_intelligence.outbox"]
    }
    connector-worker = {
      cpu           = 256
      memory        = 512
      desired_count = local.worker_desired
      image         = local.web_image
      port          = null
      public_alb    = false
      command       = ["node", "dist/workers/connector-worker.js"]
    }
    delivery-worker = {
      cpu           = 256
      memory        = 512
      desired_count = local.worker_desired
      image         = local.web_image
      port          = null
      public_alb    = false
      command       = ["node", "dist/workers/delivery-worker.js"]
    }
    scheduler = {
      cpu           = 256
      memory        = 512
      desired_count = local.worker_desired
      image         = local.web_image
      port          = null
      public_alb    = false
      command       = ["node", "dist/workers/scheduler.js"]
    }
    clamav = {
      cpu           = 512
      memory        = 2048
      desired_count = local.clamav_desired
      image         = var.clamav_image
      port          = var.clamav_port
      public_alb    = false
      command       = null
    }
  }
}
