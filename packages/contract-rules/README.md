# @contractradar/contract-rules

Pure deterministic helpers for contract-rule **validation and normalization**.

This package does **not**:
- calculate project-event deadlines
- call LLMs
- access databases
- mutate approved configuration

Inputs must already be human-approved structured rules before any future deadline engine uses them.
