# Threat model — Production operations (Slice 9)

## Assets
- Runtime configuration and secrets
- Health/readiness admission
- Logs, metrics, traces
- Queues, outbox, workers
- Kill switches and incident contacts
- Migration pipeline credentials

## Threats and controls

| Threat | Control |
|--------|---------|
| Misconfigured restricted env | `production:validate` + readiness (ADR-104/112) |
| Weak/default credentials | Policy reject (ADR-103/104) |
| Secret leakage in logs/metrics | Redaction + safe labels (ADR-110/111) |
| Unsafe migrate with runtime role | Role separation + rehearsal (ADR-116) |
| Dependency compromise | `dependency-scan` (ADR-122) |
| Unbounded blast radius incident | Kill switches + pilot pause (ADR-118) |
| Break-glass in product UI | Out-of-band only (ADR-108) |
| “Healthy” but fake providers | Readiness includes provider policy |
| Claiming live prod deploy | Mode A docs/evidence only |

## Explicit non-goals
Real production deployment; multi-region failover; productized break-glass console.
