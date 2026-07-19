# ADR-026 — Service-to-service authentication (document-intelligence)

## Status
Accepted (Slice 2B)

## Decision
1. **Preferred control plane:** outbox dispatcher and ARQ worker share Redis + Postgres; they do not call the public web app and do not need browser cookies.
2. **HTTP internal API** (`/health/ready`, `/internal/jobs/*`) requires a shared secret header `X-Internal-Token` (≥16 chars, rotated via env/secret manager).
3. **Staging/production HTTP enqueue** additionally requires timestamp + HMAC signature headers for replay resistance.
4. Tenant authorization is **never** derived solely from job payload fields; workers reload authoritative rows and reject mismatches (`PAYLOAD_TAMPER` → dead-letter).
5. Secrets never appear in URLs or logs. Rotation = deploy new token, restart DI/worker/dispatcher/web with overlapping dual-token window as a follow-up hardening item.

## Consequences
Static shared secret is acceptable temporarily with network restriction + HMAC. mTLS or SPIFFE may replace this in a later ops slice.
