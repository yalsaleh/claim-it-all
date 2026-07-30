# @contractradar/platform

Production-hardening primitives for ContractRadar Slice 9:

- environment classification (`LOCAL` / `TEST` / `CI` / `STAGING` / `PILOT` / `PRODUCTION`)
- secret-reference interface (values never returned)
- configuration validation / readiness report (redacted)
- structured log redaction helpers
- metrics label safety
- error taxonomy
- provider kill-switch keys
- pilot non-waivable readiness checks

Does not deploy infrastructure or connect live providers.
