resource "aws_ecs_cluster" "pilot" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${local.name_prefix}-cluster"
  }
}

resource "aws_ecs_cluster_capacity_providers" "pilot" {
  cluster_name = aws_ecs_cluster.pilot.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
    base              = 1
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  for_each = local.ecs_services

  name              = "/ecs/${local.name_prefix}/${each.key}"
  retention_in_days = var.log_retention_days

  tags = {
    Name    = "${local.name_prefix}-${each.key}-logs"
    Service = each.key
  }
}

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-execution"
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      Resource = [
        aws_secretsmanager_secret.app_config.arn,
        aws_secretsmanager_secret.connector_credentials.arn,
        aws_secretsmanager_secret.delivery_credentials.arn,
        # RDS-managed master user secret ARN is available after create; widen to prefix for pilot.
        "arn:aws:secretsmanager:${local.region}:${local.account_id}:secret:rds!db-*"
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${local.name_prefix}-ecs-task"
  }
}

resource "aws_iam_role_policy" "ecs_task_least_privilege" {
  name = "${local.name_prefix}-ecs-task"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DocumentsBucket"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:AbortMultipartUpload"
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*"
        ]
      },
      {
        Sid    = "BackupsBucketReadWrite"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.backups.arn,
          "${aws_s3_bucket.backups.arn}/*"
        ]
      },
      {
        Sid    = "ReadAppSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.app_config.arn,
          aws_secretsmanager_secret.connector_credentials.arn,
          aws_secretsmanager_secret.delivery_credentials.arn
        ]
      },
      {
        Sid      = "CloudWatchLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = [for lg in aws_cloudwatch_log_group.ecs : "${lg.arn}:*"]
      }
    ]
  })
}

resource "aws_ecs_task_definition" "services" {
  for_each = local.ecs_services

  family                   = "${local.name_prefix}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    merge(
      {
        name      = each.key
        image     = each.value.image
        essential = true
        environment = [
          { name = "NODE_ENV", value = "production" },
          { name = "APP_ENV", value = "pilot" },
          { name = "AWS_REGION", value = local.region },
          { name = "S3_BUCKET", value = aws_s3_bucket.documents.bucket },
          { name = "S3_BACKUPS_BUCKET", value = aws_s3_bucket.backups.bucket },
          { name = "CLAMAV_HOST", value = "clamav.${local.name_prefix}.local" },
          { name = "CLAMAV_PORT", value = tostring(var.clamav_port) },
          { name = "APP_CONFIG_SECRET_ARN", value = aws_secretsmanager_secret.app_config.arn }
        ]
        secrets = [
          {
            name      = "APP_CONFIG_JSON"
            valueFrom = aws_secretsmanager_secret.app_config.arn
          }
        ]
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.ecs[each.key].name
            awslogs-region        = local.region
            awslogs-stream-prefix = each.key
          }
        }
      },
      each.value.port != null ? {
        portMappings = [{
          containerPort = each.value.port
          hostPort      = each.value.port
          protocol      = "tcp"
        }]
      } : {},
      each.value.command != null ? { command = each.value.command } : {}
    )
  ])

  tags = {
    Name    = "${local.name_prefix}-${each.key}"
    Service = each.key
  }
}

locals {
  service_security_groups = {
    web                   = [aws_security_group.ecs_web.id]
    document-intelligence = [aws_security_group.ecs_di.id]
    arq-worker            = [aws_security_group.ecs_workers.id]
    outbox-dispatcher     = [aws_security_group.ecs_workers.id]
    connector-worker      = [aws_security_group.ecs_workers.id]
    delivery-worker       = [aws_security_group.ecs_workers.id]
    scheduler             = [aws_security_group.ecs_workers.id]
    clamav                = [aws_security_group.clamav.id]
  }
}

resource "aws_service_discovery_private_dns_namespace" "pilot" {
  name        = "${local.name_prefix}.local"
  description = "Private DNS for pilot ECS services"
  vpc         = aws_vpc.pilot.id

  tags = {
    Name = "${local.name_prefix}-dns"
  }
}

resource "aws_service_discovery_service" "services" {
  for_each = local.ecs_services

  name = each.key

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.pilot.id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = {
    Name = "${local.name_prefix}-${each.key}-discovery"
  }
}

resource "aws_ecs_service" "services" {
  for_each = local.ecs_services

  name            = "${local.name_prefix}-${each.key}"
  cluster         = aws_ecs_cluster.pilot.id
  task_definition = aws_ecs_task_definition.services[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = local.service_security_groups[each.key]
    assign_public_ip = false
  }

  dynamic "load_balancer" {
    for_each = each.value.public_alb ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.web.arn
      container_name   = "web"
      container_port   = var.web_container_port
    }
  }

  service_registries {
    registry_arn = aws_service_discovery_service.services[each.key].arn
  }

  enable_execute_command = false

  tags = {
    Name    = "${local.name_prefix}-${each.key}"
    Service = each.key
  }

  depends_on = [
    aws_lb_listener.http_redirect,
    aws_iam_role_policy.ecs_task_least_privilege
  ]
}
