# ADR-020 — Object storage key layout

## Status
Accepted (Slice 2) · Clarified (Slice 2B)

## Decision
Use a **single private bucket** with strongly separated prefixes:

```
tenants/{tenantId}/projects/{projectId}/quarantine/...
tenants/{tenantId}/projects/{projectId}/originals/...
tenants/{tenantId}/projects/{projectId}/derived/...
```

Anonymous access is disabled. Clients never choose final keys.

## Immutability guarantee (current)
Application policy + unique versioned keys under `originals/` prevent overwrite through ordinary upload APIs. Promotion verifies checksum before marking `ACCEPTED`. Bucket versioning is enabled in local MinIO init when supported.

## Stronger production option (not yet required)
S3 Object Lock (compliance/governance mode) or WORM policies for accepted originals, plus deny-delete IAM for the app role except break-glass. Track as a later ops hardening item.
