# `@contractradar/connectors`

Connector framework for incremental email / EDMS sync (Phase 3).

- Scope rules (include/exclude, date range, project references, MIME allowlist)
- External record identity and checksum helpers
- Provider interface with checkpointing and webhook validation
- Fake / local-fixture providers for tests and dev

No live Microsoft, Gmail, or EDMS connectors in this slice — interfaces only.
