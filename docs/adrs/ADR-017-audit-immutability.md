# ADR-017 — Database-enforced audit log immutability

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

## Decision

`audit_log` rejects UPDATE always, and rejects DELETE unless both:

- `app.bypass_rls = on`
- `app.allow_audit_purge = on`

This is implemented with BEFORE UPDATE/DELETE triggers.

## Retention / legal deletion

Ordinary application roles cannot purge audit rows. A separately controlled administrative procedure must:

1. Authenticate an operator outside normal product RBAC
2. Open a privileged DB session
3. `SET LOCAL app.bypass_rls = on` and `SET LOCAL app.allow_audit_purge = on`
4. Delete only within an approved retention window
5. Record the purge in an external change-management system

## Metadata hygiene

`writeAuditLog` redacts keys matching password/token/secret/session/cookie/authorization.
