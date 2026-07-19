# ADR-010 — Authentication library: Better Auth

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |
| Supersedes | DECISIONS.md ADR-010 (Proposed) |

## Context

ContractRadar needs a production-capable authentication foundation for Next.js App Router with:

- PostgreSQL / Prisma persistence
- Secure server-side sessions
- Email/password for development and early tenants
- Clear separation from tenant authorization
- A path to enterprise SSO (OIDC/SAML) later
- Testability without trusting headers, query params, or localStorage

Candidates compared: **Auth.js (NextAuth v5)** and **Better Auth**.

## Comparison

| Criterion | Auth.js | Better Auth |
|-----------|---------|-------------|
| App Router integration | Strong, mature | Strong first-party `next-js` helpers |
| PostgreSQL + Prisma | Adapter available; more boilerplate for credentials | First-class Prisma adapter; password hashing built-in |
| Session security | JWT or DB sessions; cookie config solid | DB sessions by default; secure cookie helpers |
| Multi-tenant compatibility | Neutral (org features via custom code) | Organization plugin exists; we keep **custom** Tenant models and ignore org plugin |
| Maintainability | Large ecosystem; credentials provider is awkward | Smaller surface for email/password + sessions |
| Enterprise IdP expansion | Broad provider catalog | OIDC/SSO plugins evolving; acceptable expansion path |
| Active maintenance | Very active | Active and rapidly improving |
| Testability | Good | Good; seed can reuse `hashPassword` |

## Decision

Use **Better Auth** for authentication only:

- Email/password credentials
- Prisma-backed users, sessions, accounts, verifications
- Secure HTTP-only cookies (`cr` prefix)
- Active tenant selected via a separate httpOnly cookie (`cr_active_tenant`) validated against `TenantMembership`

Authorization, tenancy, and RBAC remain ContractRadar domain modules (`@contractradar/authz` + `apps/web/src/server/authz`).

## Consequences

- Faster secure credential bootstrap with hashed passwords (no plaintext).
- Custom tenant model stays authoritative (no coupling to Better Auth organizations).
- SSO later should integrate as additional Better Auth providers/plugins without rewriting tenant isolation.
- Team must track Better Auth release notes closely (younger than Auth.js).
