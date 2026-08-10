# ADR-135 — Cloud pilot monitoring and alerts

## Status

Accepted (Slice 11)

## Decision

Pilot monitoring uses CloudWatch metrics/alarms for ALB, ECS, RDS, Redis, ClamAV health proxies,
backup freshness, and budget. Alert destinations are internal-only (console or approved ops channel).
Alerts must not include project document or notice body content.

## Consequences

Customer notification channels are out of scope. Missing approved destination → CloudWatch console only.
