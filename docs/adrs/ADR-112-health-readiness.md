# ADR-112 — Health and readiness

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Orchestrators need to distinguish process liveness from traffic readiness. A process that
is “up” but misconfigured (fake provider in PILOT, missing ClamAV, weak secrets) must not
receive user traffic.

## Decision

Split probes:

| Probe | Meaning |
|-------|---------|
| **Liveness** | Process is running; cheap self-check only |
| **Readiness** | Dependencies reachable **and** configuration policy satisfied |

Readiness for restricted environments additionally requires:

1. `validateProductionConfig` returns `ok=true` (ADR-104)
2. Malware scanner policy satisfied (ClamAV when required)
3. Critical dependencies (Postgres, Redis, object storage) responding
4. Optional: kill-switches may mark **degraded** without failing ready, unless a hard
   dependency is down

Readiness failures return non-200 with **redacted** reason codes (never secrets).
LOCAL/TEST/CI may use relaxed policies per ADR-103.

## Consequences

- Prevents “healthy but unsafe” admission
- Complements existing document-intelligence readiness
- Dependency outages are handled by runbooks (`database-unavailable`, `redis-unavailable`,
  `object-storage-unavailable`, `clamav-unavailable`)
