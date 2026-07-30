# Runbook — Security incident

## Severities (short)
- **SEV1:** active cross-tenant breach, secret leak, ransomware
- **SEV2:** suspected auth bypass, malware scanner disable attempt
- **SEV3:** policy violation without confirmed exploit

## Immediate actions
1. Pilot pause / kill-switches as needed.
2. Preserve logs and audit; do not wipe evidence.
3. Rotate exposed secrets (ADR-105); revoke sessions/grants.
4. Engage break-glass only if locked out (ADR-108).
5. Customer/legal notification per incident policy.
6. Post-incident: restore tests, dependency scan, readiness re-eval.
