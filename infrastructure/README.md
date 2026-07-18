# Infrastructure

## Docker (local data plane)

```bash
# from repository root
docker compose -f infrastructure/docker/docker-compose.yml up -d
docker compose -f infrastructure/docker/docker-compose.yml ps
```

Services:

| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL 16 | 5432 | Primary database |
| Redis 7 | 6379 | Queues / cache |
| MinIO | 9000 (API), 9001 (console) | S3-compatible object storage |

Default local credentials are for **development only** (see `.env.example`). Never reuse them in shared or production environments.

## Terraform

`infrastructure/terraform/` is reserved for later cloud packaging (SaaS or client-hosted). No providers are configured yet — avoid empty modules that imply a working cloud stack.
