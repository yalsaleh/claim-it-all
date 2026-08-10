resource "aws_vpc" "pilot" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "pilot" {
  vpc_id = aws_vpc.pilot.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.pilot.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-public-${local.azs[count.index]}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.pilot.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]

  tags = {
    Name = "${local.name_prefix}-private-${local.azs[count.index]}"
    Tier = "private"
  }
}

resource "aws_eip" "nat" {
  count  = 2
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip-${count.index}"
  }

  depends_on = [aws_internet_gateway.pilot]
}

resource "aws_nat_gateway" "pilot" {
  count = 2

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${local.name_prefix}-nat-${local.azs[count.index]}"
  }

  depends_on = [aws_internet_gateway.pilot]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.pilot.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.pilot.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count = 2

  vpc_id = aws_vpc.pilot.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.pilot[count.index].id
  }

  tags = {
    Name = "${local.name_prefix}-private-rt-${local.azs[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count = 2

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# --- Security groups ---
# ALB: public 80/443 only.
# App/workers/DI/ClamAV/DB/Redis: private ingress only from trusted SGs.
# RDS and Redis must NEVER allow 0.0.0.0/0 (enforced by scripts/cloud/network-security-check.sh).

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb"
  description = "ALB public ingress 80/443"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP from internet (redirect to HTTPS)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "To VPC targets"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "${local.name_prefix}-alb-sg"
  }
}

resource "aws_security_group" "ecs_web" {
  name        = "${local.name_prefix}-ecs-web"
  description = "Web tasks — ingress from ALB only"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description     = "From ALB"
    from_port       = var.web_container_port
    to_port         = var.web_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "Private egress via NAT"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-ecs-web-sg"
  }
}

resource "aws_security_group" "ecs_di" {
  name        = "${local.name_prefix}-ecs-di"
  description = "Document-intelligence — private only"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description     = "From web"
    from_port       = var.di_container_port
    to_port         = var.di_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_web.id]
  }

  ingress {
    description     = "From workers"
    from_port       = var.di_container_port
    to_port         = var.di_container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_workers.id]
  }

  egress {
    description = "Private egress via NAT"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-ecs-di-sg"
  }
}

resource "aws_security_group" "ecs_workers" {
  name        = "${local.name_prefix}-ecs-workers"
  description = "Worker tasks — no public ports"
  vpc_id      = aws_vpc.pilot.id

  # No public ingress. Workers initiate outbound connections only.
  egress {
    description = "Private egress via NAT"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-ecs-workers-sg"
  }
}

resource "aws_security_group" "clamav" {
  name        = "${local.name_prefix}-clamav"
  description = "ClamAV private — no public LB"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description     = "clamd from DI"
    from_port       = var.clamav_port
    to_port         = var.clamav_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_di.id]
  }

  ingress {
    description     = "clamd from workers"
    from_port       = var.clamav_port
    to_port         = var.clamav_port
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_workers.id]
  }

  egress {
    description = "Signature updates via NAT"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-clamav-sg"
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "PostgreSQL private — app SGs only; never 0.0.0.0/0"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description     = "Postgres from web"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_web.id]
  }

  ingress {
    description     = "Postgres from DI"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_di.id]
  }

  ingress {
    description     = "Postgres from workers"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_workers.id]
  }

  egress {
    description = "No required egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis"
  description = "Redis private — app SGs only; never 0.0.0.0/0"
  vpc_id      = aws_vpc.pilot.id

  ingress {
    description     = "Redis from web"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_web.id]
  }

  ingress {
    description     = "Redis from DI"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_di.id]
  }

  ingress {
    description     = "Redis from workers"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_workers.id]
  }

  egress {
    description = "No required egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name = "${local.name_prefix}-redis-sg"
  }
}
