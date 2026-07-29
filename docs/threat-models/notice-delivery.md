# Threat model — Notice delivery (Slice 7)

## Assets
- Approved draft revisions and immutable export bundles
- Dispatch package snapshots and send authorizations
- Provider credentials and webhook secrets
- Per-recipient delivery and contractual-service state
- Proof documents and audit logs
- Tenant/project isolation

## Threats and controls

| Threat | Control |
|--------|---------|
| Dispatch without approval or wrong bundle | Only approved revision + immutable export bundle; snapshot pins artifacts |
| Autonomous or accidental send | Explicit authorize + send actions; no background resend (ADR-086) |
| NotificationIntent treated as dispatch | Internal warnings only; separate dispatch domain |
| Snapshot tampering after authorize | Append-only snapshots; new content needs re-approval |
| Provider receives over-broad payload | Snapshot-derived fields only; no full DB models |
| Forged or replayed webhooks | Signature verification; event ID + timestamp replay window |
| Webhook sets contractual service | Updates delivery dimensions only; human confirmation required |
| Cross-tenant dispatch/webhook | Composite FKs + service checks + FORCE RLS on all new tables |
| Credential theft / config leak | Scoped secrets; rotation; least-privilege capabilities |
| Duplicate send on retry | Idempotency keys; new attempts require explicit user action |
| Fake provider in production | Environment guard on fake/local_capture |
| Partial failure hidden as full success | Recipient-level status axes; aggregate does not collapse |
| Deemed receipt auto-closes obligation | Advisory assessment only; no auto served transition |
| Unauthorized serve confirmation | Capability-gated human attestation with audit |

## Explicit non-goals
No autonomous resend, WhatsApp/Aconex/EDMS live connectors in Slice 7, digital signing, or AI-decided contractual service.
