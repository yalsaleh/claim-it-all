# ADR-018 — Active tenant context propagation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

## Decision

Active organization selection uses httpOnly cookie `cr_active_tenant`.

- Cookie stores a **HMAC-signed tenant UUID** (integrity only — not authorization)
- Every request revalidates `TenantMembership` server-side (`status=ACTIVE`, tenant `ACTIVE`)
- Tampered/unauthorized cookies are cleared and rejected with generic forbidden
- Tenant switch is POST-only (server action / `POST /api/tenants/select`) and audited
- Production cookies: `HttpOnly`, `Secure`, `SameSite=Lax`

## Non-goals

Cookie signing does not replace membership checks. A valid signature for a foreign tenant still fails authorization.
