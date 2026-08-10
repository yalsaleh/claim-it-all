# RDS PostgreSQL 16 — private, encrypted, backups, no public access.
resource "aws_db_subnet_group" "pilot" {
  name       = "${local.name_prefix}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

resource "aws_db_instance" "pilot" {
  identifier = "${local.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_allocated_storage_gb * 2
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "contractradar_pilot"
  username = "contractradar_admin"
  # Master password is managed by AWS Secrets Manager — no plaintext in state from git vars.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.pilot.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = var.db_backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name_prefix}-postgres-final"
  copy_tags_to_snapshot     = true

  auto_minor_version_upgrade = true
  performance_insights_enabled = false

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}

# ElastiCache Redis — private only.
resource "aws_elasticache_subnet_group" "pilot" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-redis-subnet-group"
  }
}

resource "aws_elasticache_replication_group" "pilot" {
  replication_group_id = "${local.name_prefix}-redis"
  description          = "ContractRadar pilot Redis (private)"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = var.redis_node_type
  num_cache_clusters   = 1
  port                 = 6379
  parameter_group_name = "default.redis7"

  subnet_group_name  = aws_elasticache_subnet_group.pilot.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = false
  multi_az_enabled           = false

  snapshot_retention_limit = 3
  snapshot_window          = "02:00-03:00"

  tags = {
    Name = "${local.name_prefix}-redis"
  }
}

# S3 — private documents + backups buckets.
resource "aws_s3_bucket" "documents" {
  bucket = local.documents_bucket

  tags = {
    Name = "${local.name_prefix}-documents"
    Purpose = "documents"
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = local.backups_bucket

  tags = {
    Name = "${local.name_prefix}-backups"
    Purpose = "backups"
  }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket = aws_s3_bucket.backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_ownership_controls" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_ownership_controls" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}
