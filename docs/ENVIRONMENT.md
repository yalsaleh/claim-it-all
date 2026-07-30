# Environment classification (Slice 9)

Canonical classes (ADR-103), resolved by `@contractradar/platform`:

| Class | Typical use | Fake providers | Local capture |
|-------|-------------|----------------|---------------|
| LOCAL | Developer laptop | allowed | allowed |
| TEST | Unit/integration | allowed | allowed |
| CI | GitHub Actions | allowed | allowed |
| STAGING | Pre-pilot soak | **forbidden** | allowed |
| PILOT | Controlled pilot | **forbidden** | **forbidden** |
| PRODUCTION | Future prod | **forbidden** | **forbidden** |

## Resolution

1. `CONTRACTRADAR_ENV`
2. `CI=true` → `CI` (unless `APP_ENV` set)
3. `APP_ENV` / `NODE_ENV` compatibility mapping
4. Default `LOCAL`

## Operator checks

```bash
pnpm production:validate
```

Restricted environments also require strong secrets, ClamAV, migrate-role separation, and
rejection of default credentials. See [PRODUCTION_VALIDATION.md](./PRODUCTION_VALIDATION.md).
