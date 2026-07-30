# ADR-105 — Secret references and rotation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Connector, delivery, and service credentials must not be stored as plaintext in Prisma or
returned by APIs. Rotation must not rewrite business rows with secret material. Support
and break-glass tooling must not dump secrets into logs or the product UI.

## Decision

Persist only provider-neutral **secret references**:

| Scheme | Meaning |
|--------|---------|
| `env://NAME` | Process environment variable |
| `file:///path` | File mount (Kubernetes secret volume, etc.) |
| `vault://path` | HashiCorp Vault (or compatible) path |
| `sm://project/secret` | Cloud secret manager reference |

Parsing and validation live in `@contractradar/platform` (`parseSecretReference`,
`isSecretReference`). Resolve `env://` in-process; other backends require external
injection or mount **before** startup — in-process resolution fails closed.

Optional `versionHint` labels rotation without storing secret bytes. APIs, audit events,
and admin screens record reference + version hint only.

### Rotation procedure

1. Mint new secret in the backend
2. Update reference and/or `versionHint`
3. Verify connectivity with least-privilege probe
4. Revoke old version
5. Emit audit event (no secret material)

## Consequences

- Database dumps and admin UIs never contain raw tokens.
- Incomplete resolvers prevent unsafe startup.
- Fake provider “secrets” remain CI/local only and are blocked in PILOT/PRODUCTION.
- See [SECRET_MANAGEMENT.md](../SECRET_MANAGEMENT.md).
