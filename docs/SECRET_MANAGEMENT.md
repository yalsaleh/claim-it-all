# Secret management (Slice 9)

## Rule

Store **references**, never raw secret bytes, in Prisma and admin APIs (ADR-105).

## Reference schemes

- `env://NAME`
- `file:///path`
- `vault://path`
- `sm://project/secret`

Optional `versionHint` for rotation labeling.

## Rotation

1. Mint new secret in backend
2. Update reference / version hint
3. Probe connectivity
4. Revoke old version
5. Audit (no secret material in events)

## Logging

Apply `redactSecretLike`. Never print tokens in runbooks, tickets, or CI logs.

## Break-glass

Emergency credentials are out-of-band (ADR-108), dual custody, rotated after use.
