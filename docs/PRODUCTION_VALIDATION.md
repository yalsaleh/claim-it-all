# Production validation (Slice 9)

## Purpose

Prove configuration policy before admitting traffic. Mode A evidence — not a live deploy.

## Command

```bash
pnpm production:validate
```

Uses `validateProductionConfig` from `@contractradar/platform`. Output is **redacted**.

## What fails closed (errors)

- Missing DB / Redis / object storage in restricted envs
- Runtime and migrate DB roles collapsed or bootstrap-style runtime role
- Weak / placeholder `BETTER_AUTH_SECRET`
- Default MinIO or DI tokens when policy rejects defaults
- `ALLOW_DEV_DEFAULTS` outside LOCAL/TEST/CI
- Non-ClamAV scanner when ClamAV required
- Fake/local providers in STAGING/PILOT/PRODUCTION (local-capture also blocked in PILOT/PROD)
- Insecure cookies in PILOT/PRODUCTION

## Related

- ADR-104, ADR-112
- Workflow `production-readiness` in [CI.md](./CI.md)
- Also run `pnpm integrity:check` after restores/migrations
