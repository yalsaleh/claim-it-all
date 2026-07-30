# Threat model — Support access (Slice 9)

## Assets
- Tenant metadata, documents, job histories
- Support grant tokens/sessions
- Approval records and ticket references
- Audit events tying actions to grants

## Threats and controls

| Threat | Control |
|--------|---------|
| Standing cross-tenant keys | Ticketed time-boxed grants only (ADR-107) |
| Self-approved access in pilot | Dual control: requester ≠ approver |
| Over-broad write access | Scopes limited; legal mutation forbidden |
| Grant lives forever | Max TTL; auto-expire; mandatory revoke |
| RLS bypass via support role | Queries still FORCE RLS + tenant_id |
| Document exfiltration via logs | Minimized body access; redacted logging (ADR-110) |
| Support enables fake providers | Environment policy + explicit forbid (ADR-103) |
| Support sends notices | No dispatch capability on support grants |

## Explicit non-goals
Silent “view as customer” without grant; break-glass inside product UI; unbounded document export by support.
