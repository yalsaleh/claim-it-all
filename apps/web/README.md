# `apps/web` — ContractRadar web application

Next.js + TypeScript application for authenticated project workspaces, document upload, event review, notice drafts, and audit views.

## Status

**Not scaffolded yet.** Phase 1 backlog item `A1` creates the Next.js app here.

## Planned responsibilities

- UI (including RTL-capable Arabic/English chrome)
- Domain API / server actions
- Authentication and session handling
- Tenant/project authorization enforcement
- Prisma client and migrations (schema ownership)
- Enqueue jobs for document-intelligence workers

## Non-responsibilities

- Long-running OCR / LLM pipelines (see `services/document-intelligence`)
- Autonomous notice dispatch

## Planned layout

```
src/
  app/           # App Router
  components/
  server/        # auth, authz, domain services
  lib/
prisma/          # schema + migrations
```

See [ARCHITECTURE.md](../../ARCHITECTURE.md) and [docs/backlog/phase-1.md](../../docs/backlog/phase-1.md).
