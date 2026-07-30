# Runbook — Restore procedure

## Preconditions
Incident/DR authorization; target is ephemeral sandbox or approved restore env — **not**
a random developer laptop for production dumps.

## Steps
1. Select backup manifest; verify checksums.
2. Restore Postgres → verify migration head → `pnpm integrity:check`.
3. Restore object samples from backup target (CI/MinIO for Slice 9 evidence).
4. Run adversarial cross-tenant probes (FORCE RLS).
5. Keep kill-switches engaged until validation passes; legal mutation remains human-gated.
6. Record redacted evidence for pilot checklist / incident file.

## Non-goals
Claiming real customer DR drills complete in Slice 9 Mode A.
