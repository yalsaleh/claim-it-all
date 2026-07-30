# ContractRadar — Security

Enterprise construction portfolios contain contracts, pricing, delay narratives, and dispute strategy. A breach is not only a privacy incident — it can compromise live commercial positions. This document defines the security baseline for ContractRadar.

---

## 1. Threat context

**Assets**

- Contract documents and amendments
- Correspondence and engineer instructions
- Payment and cost evidence
- Entitlement event analyses and notice drafts
- Audit trails and user identity data

**Primary threats**

- Cross-tenant data exposure
- Unauthorized project access within a tenant
- Exfiltration via AI provider prompts/logs
- Tampering with evidence or audit history
- Credential stuffing / session hijacking
- Malicious file upload (malware, zip bombs)
- Prompt injection via document content influencing trusted outputs
- Insider misuse (over-privileged staff)

---

## 2. Security principles

1. **Least privilege** — default deny; grant by role and project membership.
2. **Tenant isolation** — every data path is tenant-scoped.
3. **Evidence integrity** — originals immutable; mutations produce new versions + audit.
4. **Human control** — no autonomous legal outward actions.
5. **Defense in depth** — app checks + storage IAM + network controls (+ optional DB RLS).
6. **Secure defaults** — encryption on, public buckets off, verbose doc logging off.
7. **Assume document content is hostile** — treat uploads as untrusted input to AI and parsers.

---

## 3. Authentication

- Strong password policy or magic-link with rate limiting (Phase 1).
- HTTP-only, Secure, SameSite session cookies.
- Server-side session revocation.
- Lockout / throttling on auth endpoints.
- MFA and SSO (SAML/OIDC) for enterprise tenants (later phases).
- Separate credentials for internal service-to-service calls.

---

## 4. Authorization

- RBAC with tenant and project scopes (see ARCHITECTURE.md).
- Authorization enforced on the server for every mutation and sensitive read.
- UI hiding is not a security control.
- `auditor_readonly` cannot mutate events or notices.
- Elevation (e.g., tenant admin accessing a project) is audited.

---

## 5. Multi-tenant isolation

| Control | Requirement |
|---------|-------------|
| Data model | Mandatory `tenant_id` on tenant-owned tables |
| Queries | Central helpers that require tenant context |
| Jobs | Jobs carry tenant/project ids; workers re-check access |
| Object storage | Keys prefixed `tenants/{tenant_id}/...`; no listing across prefixes for users |
| Caching | Cache keys include tenant id |
| Testing | Automated cross-tenant negative tests in CI |

Optional later: PostgreSQL Row Level Security as defense-in-depth; dedicated DB/schema for regulated clients.

---

## 6. Data protection

### In transit

- TLS for all external traffic.
- Internal service traffic on private networks; authenticate callers.

### At rest

- Database encryption at rest (cloud default or volume encryption).
- Object storage SSE (SSE-S3 or customer-managed KMS where required).
- Secrets in env / secret manager — never in git.

### Field precision & integrity

- Checksums on stored objects.
- Write-once original versions.
- Audit log append-only via API policy.

---

## 7. Document upload safety

- Validate content types and size limits; server regenerates storage keys.
- Compute hashes; store separately from filename (filenames are display metadata only).
- Quarantine → ClamAV scan → promote to immutable originals (prefix separation).
- `MALWARE_SCANNER=fake_test` is test-only; staging/production require ClamAV.
- Scanner timeout/unavailable/malformed response never yields CLEAN.
- Download requires ACCEPTED + CLEAN; infected files stay quarantined.
- Transactional outbox prevents accepted-but-never-queued processing jobs.
- Isolate parsing/OCR in workers with resource limits.
- Do not execute embedded macros or external links during processing.
- Privileged reconciliation detects custody drift without silent repair.
- Local Mode A (`pnpm verify:local`) never claims live MinIO/Redis/ClamAV/ARQ proof.
- Authoritative live ingestion verification is the GitHub Actions **Live ingestion** workflow (Mode B).

---

## 8. AI and prompt security

- Document text may contain prompt-injection attempts (“ignore instructions…”).
- System prompts and tool policies must instruct models to extract/classify only; never to invent contractual deadlines.
- Structured output validation before execute/persist.
- Strip or avoid sending unnecessary sensitive fields to providers.
- Contractual + technical controls: no provider training on customer data where the vendor API allows.
- Store model run metadata; avoid logging full prompt bodies with sensitive clauses at info level in production.
- Tenant allowlists for which providers/models may be used.
- Contract intelligence (Slice 3): schema-validate model output before persist; never auto-approve clauses/obligations/notice rules; default `MACHINE_SUGGESTED` / `PENDING_REVIEW`; fake/fixture providers are test-only and rejected when `APP_ENV` is `production` or `staging` (ADR-034). See [docs/threat-models/contract-intelligence.md](./docs/threat-models/contract-intelligence.md).
- Event detection (Slice 5): document text is data never instructions (ADR-057); suggestions stay `PENDING_REVIEW`; fake AI test-only (ADR-050); accept ≠ deadline activation (ADR-054). See [docs/threat-models/project-event-detection.md](./docs/threat-models/project-event-detection.md).

---

## 9. Logging and monitoring

**Do log:** request ids, tenant ids, user ids, job ids, error codes, auth failures (without passwords).

**Do not log:** raw document contents, notice draft bodies, access tokens, pre-signed URL query signatures, payment primary account numbers (if ever processed).

Alert on: repeated auth failures, cross-tenant denial spikes, malware detections, privilege changes, mass downloads.

---

## 10. Auditability

- Immutable audit records for security-relevant actions (see ARCHITECTURE.md §13).
- Retention policies configurable per tenant (enterprise).
- Export for customer security reviews without exposing other tenants.

---

## 11. Secure development

- Dependency scanning in CI.
- Lint + typecheck + tests required for merge when app code exists.
- No secrets in fixtures; sample docs only in `data/samples` / `tests/fixtures`.
- Code review for tenancy, authz, and deadline/legal labeling changes.
- Environment variable validation at process start.

---

## 12. Deployment & operations

- Separate environments: local / staging / production.
- Distinct credentials per environment.
- Least-privilege cloud IAM for compute accessing S3/DB.
- Backups encrypted; restore tested.
- Client-hosted mode: customer manages network boundaries; product provides hardening guide.
- Feature flag `FEATURE_AUTO_SEND_NOTICES` remains forced off; no production path enables autonomous send.

---

## 13. Privacy & regional considerations

- GCC customers may require data residency — support region selection / client-hosted deployment.
- Minimize PII in extractions; personnel names in correspondence are business data but still sensitive.
- Provide tenant-level data export and deletion workflows (enterprise phase) consistent with contractual commitments.

---

## 14. Incident response (baseline)

1. Contain (revoke sessions, rotate keys, isolate tenant if needed).
2. Assess blast radius using audit logs and access logs.
3. Preserve forensic evidence.
4. Notify affected customers per contractual/legal duties.
5. Remediate and add regression tests.

---

## 15. Phase 1 security checklist

- [x] `.env.example` without real secrets; `.env` gitignored
- [x] Session cookies secured (Better Auth; Secure in production)
- [x] Tenant scoping helpers (`requireTenantMembership`, etc.)
- [x] Cross-tenant integration tests (require Postgres)
- [ ] Pre-signed downloads only (Slice 2)
- [x] Internal token for document-intelligence ready checks
- [x] Redacted structured logging (web + DI)
- [ ] Upload size/type limits (Slice 2)
- [ ] Legal disclaimer copy: AI outputs are not final legal advice (later slice)
- [x] No notice auto-send code paths


---

## 16. Slice 1B verification controls

- [x] PostgreSQL RLS (FORCE) on tenant-owned business tables
- [x] Transaction-local tenant GUCs (`SET LOCAL` / `set_config(..., true)`)
- [x] Audit UPDATE/DELETE blocked by triggers
- [x] Active-tenant cookie integrity (HMAC) + membership revalidation
- [x] Login rate limiting (Redis, fail-closed in production)
- [x] Seed refuses production / remote hosts without explicit override
- [x] Integration tests fail when PostgreSQL is unavailable (no silent skips)
- [x] CI provisions Postgres + Redis and runs security integration suite

## 17. Slice 3 — Contract intelligence controls

- [x] FORCE RLS on contract package / clause / obligation / notice-rule / revision tables
- [x] Machine suggestions never auto-activate as approved configuration
- [x] Approved configuration revisions immutable (DB trigger)
- [x] Segregation of duties for configuration approval (configurable)
- [x] Audit + ReviewDecision trails for review/approval mutations (entity IDs, not full clause text)
- [x] Fake AI provider rejected in production-like environments

## 18. Slice 4 — Deadline engine controls

- [x] Only active approved notice-rule snapshots may execute
- [x] Human confirmation required for event + rule applicability
- [x] Verified calculations immutable; recalculation supersedes
- [x] FORCE RLS on project-event / calendar / deadline tables
- [x] Contractual vs internal deadlines labeled separately
- [x] Threat model: [docs/threat-models/deadline-engine.md](./docs/threat-models/deadline-engine.md)
- [x] AI event detection deferred from Slice 4 (moved to Slice 5)

## 19. Slice 5 — Event detection controls

- [x] `ProjectEventSuggestion` never treated as fact / entitlement / deadline (ADR-048)
- [x] Pure detectors in `@contractradar/event-detection` — no DB/AI inside package (ADR-049)
- [x] Optional AI: schema-validated suggestions only; fake provider test-only (ADR-050)
- [x] Bounded `DetectionContextGroup`; no cross-tenant/project grouping (ADR-051)
- [x] Date suggestions unverified; relative dates need reliable source timestamp (ADR-052)
- [x] Duplicate merge advisory + human-only; evidence preserved (ADR-053)
- [x] Accept creates `ProjectEvent` only — no applicability confirm / deadline activation (ADR-054)
- [x] Append-only reviewer feedback; benchmarks ≠ legal accuracy (ADR-055)
- [x] Incremental by document version; never overwrite historical suggestions (ADR-056)
- [x] Document text treated as data, never instructions (ADR-057)
- [x] Rule candidates only from active `ApprovedNoticeRuleSnapshot`; applicability human-confirmed (ADR-058)
- [x] Threat model: [docs/threat-models/project-event-detection.md](./docs/threat-models/project-event-detection.md)
- [x] Notice drafting / evidence-completion workflows moved to Slice 6

## 20. Slice 6 — Notice drafting controls

- [x] NoticePackage bound to confirmed event + verified deadline + approved rule snapshot (ADR-059)
- [x] Immutable NoticeRequirementSnapshot — never execute from live NoticeRule (ADR-060)
- [x] Evidence completeness with non-erasing waivers (ADR-061)
- [x] Reviewer questions; unverified answers excluded from approved drafts (ADR-062)
- [x] Approved NoticeFacts only in approved draft revisions (ADR-063)
- [x] Structured sections with provenance; internalOnly never exports (ADR-064–065)
- [x] AI drafting schema-validated; fake provider test-only (ADR-066)
- [x] Recipient preparation verified; no guessed recipients (ADR-067)
- [x] Export checksums/manifests; no signing or sending (ADR-071, ADR-073)
- [x] Controlled exceptions with non-waivable blockers (ADR-070)
- [x] FORCE RLS on all notice tables; approval append-only; SoD
- [x] Threat model: [docs/threat-models/notice-drafting.md](./docs/threat-models/notice-drafting.md)
- [ ] Controlled delivery / dispatch / acknowledgments (deferred — next slice)


## Slice 7 delivery controls

Controlled notice delivery requires immutable dispatch snapshots, explicit human authorization, explicit send action, FORCE RLS on dispatch tables, verified webhooks, and human confirmation of contractual service. See `docs/threat-models/notice-delivery.md`.

## Slice 8 connectors and operations

- Import-only `ConnectorProjectScope`; no export or autonomous legal mutation (ADR-087, ADR-102).
- `fake` / `local_fixture` providers rejected in production and staging (ADR-089).
- Connector credentials stored as `secretReference` only — never raw secrets in the database.
- Segregation of duties on connector account and scope approval (`CONNECTOR_SOD`).
- Operational alerts are deterministic and deduplicated; `InternalNotification` is in-app only and never used for contractual notice dispatch.
- Portfolio dashboard respects project membership — no cross-tenant or tenant-wide leakage for restricted roles.
- Threat model: [docs/threat-models/connectors-and-operations.md](./docs/threat-models/connectors-and-operations.md)

## Slice 9 production hardening

- Environment classes `LOCAL`/`TEST`/`CI`/`STAGING`/`PILOT`/`PRODUCTION`; fake and local-capture providers **blocked in PILOT/PRODUCTION** (ADR-103/104).
- Secret references only (`env://`, `file://`, `vault://`, `sm://`); rotation without storing secret bytes (ADR-105).
- Support access is ticketed, time-boxed, dual-controlled; FORCE RLS retained (ADR-107).
- Break-glass is **out-of-band policy only — not in the product UI** (ADR-108).
- Structured log/metric redaction; readiness includes configuration policy (ADR-110–112).
- Backups/restores evidenced in **CI/MinIO only**; no real customer DR claimed (ADR-113/114).
- Kill switches fail closed; pilot readiness non-waivable checklist (ADR-118/119).
- Supply-chain scanning + deployment hardening documented; **no real deployment claimed** (ADR-122/123).
- Threat models: [tenant-administration](./docs/threat-models/tenant-administration.md), [support-access](./docs/threat-models/support-access.md), [backups-restores](./docs/threat-models/backups-restores.md), [provider-onboarding](./docs/threat-models/provider-onboarding.md), [production-operations](./docs/threat-models/production-operations.md), [pilot-deployment](./docs/threat-models/pilot-deployment.md).
