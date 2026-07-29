# ADR-063 — Approved NoticeFacts

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Drafting must not invent dates, amounts, parties, or clauses.

**Decision:** NoticeFact is a human-reviewed factual input with verification status and approvedForDrafting. Only approved facts may appear in an approved draft revision. Client HTML is forbidden; values are plain text with length bounds.

**Consequences:** Deterministic and AI drafting share the same approved-fact gate.
