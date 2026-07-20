# Threat model — Deterministic deadline engine (Slice 4)

## Threats and mitigations

| Threat | Mitigation |
|--------|------------|
| Wrong trigger date | Verified `ProjectEventDate` + evidence required; precision gates |
| Wrong timezone | Explicit timezone on event/calendar/calculation; Luxon IANA zones |
| Calendar corruption | Immutable approved calendar revisions; calculations pin revision id |
| Unapproved rule execution | Only `ApprovedNoticeRuleSnapshot` from active configuration |
| Amendment supersession | New configuration revision + recalculation; prior results immutable |
| Internal vs contractual confusion | Milestone kind CONTRACTUAL vs INTERNAL; UI labels |
| Stale configuration | Calculations pin `configurationRevisionId`; active pointer changes do not rewrite history |
| Forged evidence | Cross-project/tenant FKs + RLS; evidence revalidation |
| Silent recalculation | New calculation + supersession + mandatory reason + audit |
| DST / month-end bugs | Luxon + explicit month-roll / blocked if undefined |
| Vague expressions | PROMPT/REASONABLE_TIME always BLOCKED for contractual deadline |
| Malicious inputs | Zod validation; HTML treated as data; size bounds |
| Cross-tenant linking | Composite FKs + FORCE RLS |
| Unauthorized verification | Capabilities + configurable SoD |

## Out of scope (deferred)
Notice drafting/sending, claim-value risk. AI event detection is covered separately in [project-event-detection.md](./project-event-detection.md) (Slice 5).
