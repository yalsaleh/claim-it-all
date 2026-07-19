# ADR-019 — Authentication rate limiting

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-18 |

## Decision

Login attempts are rate-limited per IP+email (10 / 60s) using Redis (`ioredis`) when available.

- Production **fails closed** if Redis is unavailable (unless `ALLOW_DEV_DEFAULTS` is explicitly enabled — forbidden in real production by env validation)
- Development may fall back to in-memory limiting
- Login failures always return a generic message (no email enumeration)

## Boundaries

Email verification, MFA, and enterprise SSO remain later work. Session revocation uses Better Auth sign-out / session table deletes.
