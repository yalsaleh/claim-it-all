# Runbook — Audit integrity failure

## Symptoms
Audit append fails; hash chain / immutability check fails; unexpected UPDATEs on audit tables.

## Immediate actions
1. Treat as SEV1/SEV2 security incident.
2. Pilot pause; freeze privileged admin changes.
3. Capture DB evidence; do not “repair” by deleting audit rows.
4. Run `integrity:check`; compare to last known-good backup.
5. If tampering suspected: restore to sandbox, preserve compromised volume for forensics.
6. Rotate operator credentials; review support grants and break-glass usage.
