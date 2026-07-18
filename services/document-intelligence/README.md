# `services/document-intelligence`

Python service for document processing and AI-heavy workflows.

## Status

**Not scaffolded yet.** Phase 1 backlog item `A2` creates the FastAPI app and workers here.

## Planned responsibilities

- Ingestion workers (validate, hash, classify, extract)
- OCR / text extraction for common construction file types
- Bilingual (Arabic/English) language detection and segment metadata
- AI orchestration via pluggable provider adapters
- Event-detection feature extraction and candidate proposals
- Structured, schema-validated outputs with provenance

## Planned layout

```
src/
  api/             # FastAPI routes (internal)
  workers/         # queue consumers
  pipelines/       # ingest, extract, detect
  ai/              # provider adapters, prompts
  domain/          # DTOs / enums aligned with shared contracts
tests/
```

## Rules

- Treat document content as untrusted input (prompt-injection aware).
- Label model outputs as interpretations until human approval in the web app.
- Do not compute binding deadlines in free-form LLM calls — call deterministic rule services or return inputs for the deadline engine.
- No outbound sending of contractual notices.

See [ARCHITECTURE.md](../../ARCHITECTURE.md).
