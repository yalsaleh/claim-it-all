# Pilot readiness (Slice 9)

Evidence-based gate (ADR-119). Slice 9 Mode A produces checklist evidence; it does **not**
execute a real customer pilot deploy.

## Non-waivable items

- tenant isolation tests / RLS forced
- recent successful backup + successful restore test
- production secrets configured; fake providers disabled
- runtime DB role restricted
- incident contacts + support access policy configured
- audit logging + monitoring operational

## Evaluation

`@contractradar/platform` `evaluatePilotReadiness` / `defaultPilotChecklist`.
Non-waivable items cannot be cleared with `approvedException`.

## Activate only when

`canActivate=true` and evidence is unexpired. Next phase: **controlled pilot deployment**.

Related: [DEPLOYMENT.md](./DEPLOYMENT.md), [PRODUCTION_VALIDATION.md](./PRODUCTION_VALIDATION.md).
