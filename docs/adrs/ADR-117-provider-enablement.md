# ADR-117 — Provider enablement

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Real mailbox/EDMS/SMTP/AI providers were not enabled for Slice 8. Slice 9 must define how
a provider becomes allowed without smuggling `fake` / `local_fixture` / `local_capture`
into PILOT or PRODUCTION.

## Decision

Provider enablement is a controlled checklist — documentation and gates only; **no real
provider onboarding is performed by Slice 9 Mode A**:

1. Adapter implements the provider-neutral interface for its domain
2. Credentials stored as secret references only (ADR-105)
3. Environment policy allows the provider class (ADR-103) — **fake/local blocked in
   PILOT/PRODUCTION**; local-capture blocked in PILOT/PRODUCTION
4. Corresponding kill-switch key exists and is tested (ADR-118)
5. Threat-model update + dual-control approval for the pilot tenant scope
6. Staging soak with policy-allowed non-prod credentials where applicable
7. Pilot readiness evidence recorded (ADR-119)
8. Observability: metrics/logs use safe labels (ADR-110/111)

Guide: [PROVIDER_ONBOARDING.md](../PROVIDER_ONBOARDING.md).
Threat model: [provider-onboarding.md](../threat-models/provider-onboarding.md).

## Consequences

- Prevents accidental enablement via env typos
- Live commercial providers remain explicitly **not claimed**
- Kill switches provide immediate disable without redeploy
## Explicit non-goals

- Enabling live Microsoft/Google/EDMS/SMTP in this documentation slice
- Treating staging local-capture as production-ready
- Bypassing kill-switch registration for “temporary” providers
