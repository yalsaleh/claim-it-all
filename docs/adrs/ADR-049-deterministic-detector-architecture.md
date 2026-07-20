# ADR-049 — Deterministic detector architecture

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-20 |

**Context:** Hybrid detection needs a trustworthy baseline that can run in CI without providers and that reviewers can explain. Embedding DB access or LLM calls inside detectors would couple versioning, tenancy, and non-determinism into the core package.

**Decision:** Place pure, versioned detectors in `@contractradar/event-detection`. Detectors are deterministic functions over serializable inputs (document text/features, metadata, prior suggestion ids within the same context). They must not open database connections, call AI providers, or perform authz. Detector versions are recorded on suggestion/run metadata for audit and replay.

**Consequences:** Orchestration (scan jobs, persistence, tenancy) lives outside the package. Unit tests exercise detectors with fixtures only. Optional AI enrichment is a separate adapter boundary (ADR-050), not inside pure detectors. Package upgrades that change detector versions are explicit and auditable.
