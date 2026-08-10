resource "aws_lb" "pilot" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true
  enable_deletion_protection = false

  tags = {
    Name = "${local.name_prefix}-alb"
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_prefix}-web"
  port        = var.web_container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.pilot.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health/live"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = {
    Name = "${local.name_prefix}-web-tg"
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.pilot.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.pilot.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# Fail closed: workloads must not be enabled without an ACM certificate for HTTPS.
check "https_required_when_deploying" {
  assert {
    condition     = !var.enable_deployment || var.certificate_arn != ""
    error_message = "certificate_arn must be set when enable_deployment=true (ALB HTTPS)."
  }
}
