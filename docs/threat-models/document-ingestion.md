# Threat model — Document ingestion (Slice 2 / 2B)

| Threat | Mitigation |
|--------|------------|
| Malicious uploads / parser exploits | Quarantine; malware scan; size/page/cell limits; no execution; restricted parsers |
| Oversized files / archive bombs | Declared + actual size checks; archives unsupported initially; workbook/CSV limits |
| Storage-key attacks / traversal | Server-generated keys; reject `..` in filenames; no client-controlled final keys |
| Signed URL leakage | Short TTL; audit on authorize; never log URLs |
| Cross-tenant access | FORCE RLS; composite tenant/project triggers; authz on every API |
| Checksum probing across tenants | Duplicate lookup scoped to tenant+project only |
| Unscanned treated as clean | Explicit malware statuses; download requires CLEAN; FakeScanner refused outside tests |
| Scanner unavailable / timeout | ERROR / retry / quarantine — never CLEAN; readiness fails when scanner down |
| Lost processing job after accept | Transactional outbox (ADR-025); dispatcher + idempotent ARQ worker |
| Queue payload tampering | Worker reloads DB rows; mismatch → dead-letter |
| HTTP worker auth replay | Internal token + HMAC timestamp/signature in staging/production (ADR-026) |
| Metadata injection | Sanitize audit/ingestion metadata; no body logging |
| Worker privilege | Controlled RLS bypass only inside worker transactions after ID verification |
| False READY | READY invariant: ACCEPTED + CLEAN + originals key + SUCCEEDED run + derived artifacts |
| Custody drift | Privileged `reconcile-ingestion` dry-run/apply with ingestion events |

## READY invariant

`SourceDocument.status = READY` is only valid when the current version is `ACCEPTED`, `malwareScanStatus = CLEAN`, `storageKey` is under `/originals/` (not quarantine), the processing run is `SUCCEEDED`, and at least one derived artifact exists.

## Verification modes

- **Locally verified (Mode A):** static checks, unit tests, embedded Postgres, parser/scanner contract tests — never live object storage/queue/scanner.
- **CI live verified (Mode B):** `live-ingestion.yml` — real Postgres, Redis, MinIO, ClamAV, ARQ, outbox, full upload path.
- Slice 2B is operationally verified only after Mode B completes successfully.
