# ADR-108 — Break-glass policy

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Catastrophic outages or locked-out operators may require emergency elevation. Placing
break-glass controls in the product UI invites abuse, weakens customer trust, and creates
an unauditable superuser path that bypasses dual control.

## Decision

Break-glass is an **out-of-band operational procedure**, not a product feature.

### Policy

- Credentials/keys live in a sealed offline / HSM / password-manager vault with dual custody
- Activation requires incident ID, two operators, and written justification
- Use is time-boxed (default ≤ 1 hour), continuously audited, and followed by mandatory
  post-incident rotation of all touched secrets
- Break-glass must **not** permanently weaken RLS, disable audit immutability, or enable
  autonomous notice send (`FEATURE_AUTO_SEND_NOTICES` remains forced off)
- **No break-glass control appears in the ContractRadar product UI**

### After-action (mandatory)

1. Revoke emergency credentials immediately after the window
2. Rotate secrets and session signing keys if exposure is possible
3. File incident report with timeline, systems touched, and blast radius
4. Re-run `production:validate` and `integrity:check`
5. Review whether kill-switches or pilot-pause should remain engaged

## Consequences

- Emergency recovery remains possible; product surface stays free of hidden superuser paths
- Slice 9 documents policy only — it does **not** ship a break-glass console
- Runbooks: [break-glass.md](../runbooks/break-glass.md), [security-incident.md](../runbooks/security-incident.md)
