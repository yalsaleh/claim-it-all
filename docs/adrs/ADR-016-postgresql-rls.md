# ADR-016 — PostgreSQL Row-Level Security for tenant isolation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

## Context

Application-layer `tenantId` filtering is necessary but insufficient. A missed `where` clause must not leak cross-tenant rows.

## Decision

Enable **FORCE ROW LEVEL SECURITY** on tenant-owned business tables:

- `tenant`
- `tenant_membership`
- `project`
- `project_membership`
- `audit_log`

Trusted server code sets transaction-local GUCs via `set_config(..., is_local := true)`:

- `app.current_user_id`
- `app.current_tenant_id`
- `app.bypass_rls` (seed/admin/fixtures only)

### Auth tables excluded

Better Auth tables (`user`, `session`, `account`, `verification`) are **not** under RLS. Auth precedes tenancy; putting sessions behind tenant GUCs would break login and multi-tenant membership discovery.

### Connection pooling

Only `SET LOCAL` / `set_config(..., true)` is used inside Prisma `$transaction` blocks so pooled connections cannot leak tenant context.

### Roles

- `contractradar` — bootstrap/migration role (may be superuser in local Docker/embedded)
- `contractradar_app` — runtime application role (`NOSUPERUSER`, `NOBYPASSRLS`)

Runtime `DATABASE_URL` must use `contractradar_app`. Migrations use `DATABASE_MIGRATE_URL` when distinct.

### Bypass

`withBypassRls` is reserved for seed, test fixtures, and controlled administrative retention. Request handlers must never set bypass.

## Consequences

- Defense-in-depth aligned with application authorization
- Slightly more ceremony (`withTenantTransaction`)
- Migrations remain table-owner operations; FORCE RLS still requires bypass for seed/fixtures
