# Restore (Slice 9)

## Purpose

Prove backups restore isolation-preserving state (ADR-114).

## CI evidence

Workflow `backup-restore` restores into ephemeral resources and runs `integrity:check`
plus cross-tenant probes. **CI/MinIO only** for Slice 9.

## Manual outline

1. Verify manifest checksums
2. Restore DB → `pnpm integrity:check`
3. Restore object samples; verify checksums
4. Keep kill-switches on until validated
5. File redacted evidence for pilot checklist

Runbook: [runbooks/restore-procedure.md](./runbooks/restore-procedure.md).
