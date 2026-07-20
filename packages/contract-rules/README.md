# @contractradar/contract-rules

Pure deterministic helpers for contract-rule **validation/normalization** (Slice 3) and **deadline calculation** (Slice 4).

This package does **not**:
- query databases or call Prisma
- call LLMs or read files
- perform authorization
- mutate project data

Deadline inputs must be serializable approved-rule snapshots, verified trigger dates, and approved calendar revisions. Vague timing (`PROMPT` / `REASONABLE_TIME`) always blocks contractual calculation.
