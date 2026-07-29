# ADR-091 — Import through existing ingestion

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** A parallel connector ingestion path would bypass malware scan, outbox durability, and READY invariants established in Slice 2/2B.

**Decision:** All connector imports create `SourceDocument` + `DocumentVersion` rows and enqueue `process_document_version` via the transactional outbox (ADR-025)—the same path as manual upload. Connector provenance is recorded on `ExternalRecord` and ingestion metadata; workers reload DB state; no queue payload carries document bytes. No shortcut APIs that skip scan, quarantine, or processing.

**Consequences:** Connector failures surface in the same ingestion statuses operators already monitor. One READY invariant for all origins. Duplicate external keys map to existing versions without reprocessing when checksum matches.
