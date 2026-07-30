# ADR-123 — Deployment hardening

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

When a controlled pilot deploy eventually happens, the runtime must be hardened. Slice 9
documents the bar and CI gates without performing or claiming a real deployment.

## Decision

Hardening checklist for any future PILOT/PRODUCTION runtime:

1. Non-root containers; read-only rootfs where feasible; no privileged containers
2. Secrets via references / runtime injection — never baked into images or committed
3. Network policies: Postgres / Redis / object storage not public; document-intelligence
   authenticated (ADR-026)
4. Migrate job uses separated credentials from the runtime service account (ADR-104/116)
5. Fake and local-capture providers blocked; `production:validate` must pass
6. Backup/restore evidence current (ADR-113/114)
7. Kill switches and incident contacts configured (ADR-118/119)
8. Break-glass remains out-of-band (ADR-108) — **not in product UI**
9. Health/readiness probes distinguish live vs ready (ADR-112)
10. Supply-chain scans clean for known criticals (ADR-122)

CI workflow `production-readiness` aggregates validation + checklist evidence.
Guide: [DEPLOYMENT.md](../DEPLOYMENT.md).

## Consequences

- Deployment is gated and evidence-based
- **No real deployment is performed or claimed by Slice 9 Mode A documentation**
- Next phase after evidence: controlled pilot deployment
## Explicit non-goals (Slice 9 Mode A)

- Performing a real cloud or on-prem pilot deployment
- Claiming Kubernetes/Helm charts are production-certified
- Putting break-glass into the product UI

Next phase after evidence: **controlled pilot deployment**.
