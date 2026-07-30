# Threat model — Backups and restores (Slice 9)

## Assets
- PostgreSQL dumps (schema, RLS, tenant data)
- Object storage backups / manifests
- Backup encryption keys
- Restore sandboxes and CI artifacts
- Integrity check results

## Threats and controls

| Threat | Control |
|--------|---------|
| Untested backups | CI `backup-restore` + non-waivable pilot gate (ADR-114/119) |
| Secrets inside DB dumps | Secret references only (ADR-105) |
| Restore breaks RLS | Post-restore adversarial tenant probes |
| Backup theft | Encrypt at rest; restrict backup target IAM |
| Restore onto unsafe laptop | Forbidden for production dumps; ephemeral CI/sandbox only |
| Partial restore corrupts legal state | Prefer pilot pause; human-gated legal mutation after restore |
| Manifest tampering | Checksums + pipeline identity in manifest (ADR-113) |
| Claiming real cloud DR | Docs explicit: CI/MinIO evidence only for Slice 9 |

## Explicit non-goals
Live multi-region replication; real customer restore drills; production offsite claims.
