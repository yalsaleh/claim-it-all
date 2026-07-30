# Tenant administration (Slice 9)

## Lifecycle (ADR-106)

`ACTIVE` → `SUSPENDED` → resume `ACTIVE` **or** `OFFBOARDING` → `ARCHIVED`

| Action | Effect |
|--------|--------|
| Suspend | Block writes, connector sync, dispatch |
| Resume | Re-check limits + kill-switches |
| Offboard | Export → retention hold → purge → verify ([ADR-121](./adrs/ADR-121-retention-offboarding.md)) |

## Roles

- **Tenant admin:** in-tenant RBAC only
- **Platform operator:** lifecycle + limits; audited; not silent impersonation
- **Support:** separate grants (see [SUPPORT_ACCESS.md](./SUPPORT_ACCESS.md))

## Limits

See ADR-120 (`active_projects`, storage, imports, AI, dispatch, …). Hard exceed →
`LIMIT_EXCEEDED`.

## Forbidden

Break-glass controls in product UI; autonomous legal-state mutation on suspend/resume.
