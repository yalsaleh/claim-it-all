# Workflow — Event review and notice drafting

## Actors

- Commercial reviewer / contracts manager
- Optional project member answering follow-ups
- System (draft assistance only)

## Steps

1. Open **review queue** (sorted by deadline urgency).
2. Open an **event detail**:
   - Category and summary
   - Facts vs interpretations vs assumptions vs missing information
   - Clause links and obligation rules
   - Deadline calculation trail
   - Evidence and gaps
3. Optionally assign **follow-up questions** to close gaps.
4. Request or generate a **notice draft** (template or AI-assisted).
5. Human **approve / reject / request revision**.
6. Optionally record **manual dispatch** after the approved notice is sent outside the system.

## Hard rules

- AI draft language is never final legal advice.
- Drafts start as `draft` / `pending_review`.
- No code path sends notices automatically.
- Every decision writes an audit record.

## State summary

See [DOMAIN_MODEL.md](../../DOMAIN_MODEL.md) §15 for `EntitlementEvent` and `NoticeDraft` state machines.
