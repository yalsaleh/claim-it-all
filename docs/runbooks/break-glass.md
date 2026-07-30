# Runbook — Break-glass

## Warning
**Out-of-band only. Not available in the product UI.**

## Steps
1. Open incident; dual custody retrieval of sealed credentials.
2. Two operators acknowledge scope and time box (≤ 1h default).
3. Use minimum access to restore operations; keep audit on.
4. Do not disable RLS or enable autonomous notice send.
5. End window: revoke credentials; rotate secrets; `production:validate` + `integrity:check`.
6. Complete after-action report.

See ADR-108 and [security-incident.md](./security-incident.md).
