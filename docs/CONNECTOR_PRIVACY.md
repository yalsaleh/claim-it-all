# Connector privacy guide

Controlled connectors import selected project records as evidence. They never grant unrestricted mailbox or repository access.

## Principles

- Users must explicitly select mailbox/folder/label/repository scope, include/exclude rules, document types, and date range.
- Entire-account or entire-mailbox ingestion is not the default and is not supported without separate approval.
- Credentials are stored as secret references only — never plaintext tokens in Prisma, logs, queue payloads, or AuditLog.
- Imported immutable evidence follows ContractRadar retention; the platform does not promise deletion from external systems.
- External deletion is recorded as a source-state flag; it does not silently delete imported evidence.
- Cross-project and cross-tenant imports are blocked.
- Fake/local providers are for tests and local fixtures only; production/staging reject them.

## Approval chain

1. Create connector account → validate configuration  
2. Define project scope → reviewer inspects → authorized approver activates  
3. Manual test sync → review imported records  
4. Optional scheduled sync (hourly/daily only)  
5. Scope changes require new approval  

Credential validation alone never activates a connector.

## Related

- Threat model: [threat-models/connectors-and-operations.md](./threat-models/connectors-and-operations.md)
- ADRs 087–093, 102
