resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10
  treat_missing_data  = "notBreaching"
  alarm_description   = "Pilot ALB target 5XX spike"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    LoadBalancer = aws_lb.pilot.arn_suffix
  }

  tags = {
    Name = "${local.name_prefix}-alb-5xx"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name_prefix}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_description   = "Pilot RDS CPU high"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.pilot.id
  }

  tags = {
    Name = "${local.name_prefix}-rds-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.name_prefix}-redis-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  alarm_description   = "Pilot Redis CPU high"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.pilot.id
  }

  tags = {
    Name = "${local.name_prefix}-redis-cpu"
  }
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu_web" {
  alarm_name          = "${local.name_prefix}-ecs-web-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"
  alarm_description   = "Pilot web ECS CPU high"
  alarm_actions       = var.alarm_actions
  ok_actions          = var.alarm_actions

  dimensions = {
    ClusterName = aws_ecs_cluster.pilot.name
    ServiceName = aws_ecs_service.services["web"].name
  }

  tags = {
    Name = "${local.name_prefix}-ecs-web-cpu"
  }
}

# AWS Budgets — monthly cost alarm tagged to the pilot cost center.
# Notifications require budget_alert_email and/or alarm_actions (SNS).
resource "aws_budgets_budget" "pilot" {
  name         = "${local.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = [format("user:CostCenter$%s", var.cost_center)]
  }

  dynamic "notification" {
    for_each = var.budget_alert_email != "" ? [80, 100] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = notification.value == 100 ? "FORECASTED" : "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }

  dynamic "notification" {
    for_each = length(var.alarm_actions) > 0 && var.budget_alert_email == "" ? [80] : []
    content {
      comparison_operator       = "GREATER_THAN"
      threshold                 = 80
      threshold_type            = "PERCENTAGE"
      notification_type         = "ACTUAL"
      subscriber_sns_topic_arns = var.alarm_actions
    }
  }
}
