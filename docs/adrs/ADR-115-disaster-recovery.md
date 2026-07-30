# ADR-115 — Disaster recovery

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Operators need RTO/RPO targets and decision trees even before a full SaaS multi-region
deploy exists. Documentation must set expectations without implying live failover.

## Decision

Document DR tiers without claiming live multi-region:

| Tier | Scope | Indicative RPO | Indicative RTO |
|------|-------|----------------|----------------|
| T0 | Single-node local/CI | n/a | rebuild from git + fixtures |
| T1 | Pilot single region | ≤ 24h backup | ≤ 24h restore + validate |
| T2 | Future production | ≤ 1h (PITR goal) | ≤ 4h failover goal |

### Fail-forward preferences (priority order)

1. Preserve audit integrity and evidence immutability
2. Restore auth + tenant isolation
3. Resume ingestion pipeline
4. Resume connectors (if approved)
5. Resume delivery providers (human-gated)

Legal-state mutation remains human-gated after restore. Prefer **pilot pause**
(runbook) over unsafe partial recovery that could mis-order deadlines or dispatch.

Guide: [DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md).

## Consequences

- Clear expectations for Slice 9 Mode A
- Actual cloud failover engineering is future work; docs must not imply it is deployed
- Backup/restore ADRs (113–114) are the executable evidence path today
