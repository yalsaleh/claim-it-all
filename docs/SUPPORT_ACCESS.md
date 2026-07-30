# Support access (Slice 9)

Ticketed, time-boxed, least-privilege, audited (ADR-107).

## Grant checklist

1. Ticket ID + tenant + scope + duration (≤ 8h default)
2. Approver ≠ requester in PILOT/PRODUCTION
3. Distinct support session; FORCE RLS retained
4. Minimize document body access
5. Revoke on completion; confirm audit events

## Scopes

`read_metadata` · `read_documents` · `replay_jobs`

## Forbidden

Fake providers, notice dispatch, legal confirmation, silent impersonation, product UI
break-glass.

Runbook: [runbooks/support-access.md](./runbooks/support-access.md).
