# Disaster recovery (Slice 9)

Design targets (ADR-115) — **not** a claim of live multi-region failover:

| Tier | RPO (indicative) | RTO (indicative) |
|------|------------------|------------------|
| T0 local/CI | n/a | rebuild from git |
| T1 pilot | ≤ 24h | ≤ 24h restore + validate |
| T2 future prod | ≤ 1h goal | ≤ 4h goal |

## Priority after restore

1. Audit integrity
2. Auth + tenant isolation
3. Ingestion
4. Connectors
5. Delivery (human-gated)

Prefer [pilot-pause](./runbooks/pilot-pause.md) over unsafe partial recovery.
