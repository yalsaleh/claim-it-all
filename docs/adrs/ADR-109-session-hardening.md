# ADR-109 — Session hardening

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Pilot and production sessions face cookie theft, fixation, and long-lived idle risk.
Development auth shortcuts and insecure cookies must not leak into restricted environments.
Support grants (ADR-107) need stricter session properties than ordinary users.

## Decision

For `PILOT` and `PRODUCTION` (and STAGING where noted):

1. Secure, HttpOnly, SameSite-appropriate session cookies via Better Auth; `cookieSecure`
   required by ADR-104 validation
2. Absolute and idle session TTLs appropriate to risk; shorter TTL for support grants
3. Step-up / re-authentication for high-risk capabilities: dispatch authorize, connector
   approve/revoke, tenant suspend/offboard, kill-switch changes
4. Session revocation on password change, role change, and support-grant expiry
5. No dev auth shortcuts or debug session minting outside LOCAL/TEST/CI (ADR-103 policy)
6. Login rate limiting remains fail-closed when Redis is unavailable in restricted envs
   (ADR-019)
7. Support sessions use separate credentials and stricter TTL than user sessions
8. Session identifiers must not appear in URLs or info-level logs

## Consequences

- Aligns session policy with environment classification
- Mode A validates configuration flags; enterprise SSO/MFA remains Phase 5
- Stolen cookies have bounded lifetime; high-risk actions need fresh confirmation
## Alternatives considered

- Infinite sessions for convenience — rejected for PILOT/PRODUCTION.
- Embedding break-glass into session elevation UI — rejected (ADR-108).
- Sharing support and user session cookies — rejected; grants must be distinct.
