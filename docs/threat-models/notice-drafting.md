# Threat model — Notice drafting (Slice 6)

## Assets
- Approved notice text and export bundles
- Approved NoticeFacts and requirement snapshots
- Recipient/contact details
- Attachment checksum integrity
- Tenant/project isolation

## Threats and controls

| Threat | Control |
|--------|---------|
| Invented facts/dates/amounts/clauses/recipients | Approved-fact-only drafting; AI schema validation; deterministic validators |
| Incorrect deadline in notice | Bind to verified DeadlineCalculation; reject AI deadline drift |
| Stale configuration or calculation | Package pins revision/snapshot/calculation IDs; supersession blocks approval |
| Prompt injection in correspondence | Untrusted source text; structured AI output; no tool execution |
| Hidden text / malicious HTML | Plain-text sections; escape on render; no arbitrary HTML |
| Unsupported legal conclusions | Section allowlist; conclusion patterns rejected |
| Internal comment leakage | internalOnly flag; export filters comments/metadata |
| Cross-tenant/project evidence | Composite FKs + service checks + FORCE RLS |
| Unauthorized approval | Capabilities + optional SoD |
| Forged recipient details | Verified ContactPoint/preparation status; non-waivable invented recipient |
| Export tampering / attachment substitution | Immutable manifests + checksums |
| Bilingual mismatch | Per-language approval + conflict warnings |
| Fake provider in production | Environment guard |
| Malicious template | System/tenant approved templates only |
| Unsafe PDF/DOCX/ZIP | Path traversal rejection; size limits; no macros |
| Unapproved notice labeled approved | Export only from APPROVED revision |

## Explicit non-goals
No automatic sending, signatures, claim valuation, or autonomous legal advice.
