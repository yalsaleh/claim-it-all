# ADR-110 — Structured logging

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Operators need correlatable logs for incidents and queue failures without leaking contract
clauses, notice bodies, tokens, cookies, or signed URLs into centralized log stores.

## Decision

Emit structured JSON logs with stable fields:

- `timestamp`, `level`, `service`, `event`, `error_code`
- `request_id`, `job_id` when applicable
- `tenant_id`, `project_id` when known and authorized for that stream

Redaction rules:

1. Apply `redactSecretLike` from `@contractradar/platform` to structured payloads
2. Deny-list keys matching password / secret / token / authorization / cookie /
   credential / signedUrl (case-insensitive)
3. Never log full clause text, notice bodies, or raw document contents at info/warn in
   restricted environments
4. Prefer epistemic-safe event names (`dispatch_attempt_failed`, `outbox_stalled`) over
   payload dumps
5. Propagate correlation IDs across web → outbox → ARQ → document-intelligence

Audit logs remain the append-only system of record for security-relevant actions
(ADR-017); application logs must not become a shadow store of secret material.

## Consequences

- Safer incident response and SIEM ingestion
- Guide: [OBSERVABILITY.md](../OBSERVABILITY.md)
- Logging violations are treated as security defects in review
