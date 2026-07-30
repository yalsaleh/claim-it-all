# Provider onboarding (Slice 9)

## Status

**No real providers are onboarded in Slice 9.** This guide is the enablement checklist
(ADR-117) for a future controlled pilot.

## Checklist

1. Provider-neutral adapter implemented
2. Secrets as references only
3. Environment policy allows provider — **fake/local blocked in PILOT/PRODUCTION**
4. Kill-switch key registered and tested
5. Threat model updated; dual-control approval for tenant scope
6. Staging soak under STAGING policy (local-capture may be allowed there)
7. Pilot readiness evidence attached
8. Safe metrics/log labels

## Disable

Use kill-switches (ADR-118) or [pilot-pause](./runbooks/pilot-pause.md).
