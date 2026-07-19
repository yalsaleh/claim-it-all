# `@contractradar/web`

Next.js App Router application for ContractRadar platform foundation.

## Scripts

```bash
pnpm --filter @contractradar/web dev
pnpm --filter @contractradar/web test:unit
pnpm --filter @contractradar/web test:integration
pnpm --filter @contractradar/web db:migrate:deploy
pnpm --filter @contractradar/web db:seed
```

## Routes (Slice 1)

- `/` landing
- `/login`
- `/select-organization`
- `/projects`
- `/projects/[projectId]`
- `/unauthorized`
- `/api/health`
- `/api/auth/[...all]` Better Auth handler

## Notes

- Tenant context comes from authenticated membership + `cr_active_tenant` cookie.
- Client-supplied `tenantId` is never trusted for authorization.
- No entitlement analytics or AI surfaces in this slice.
