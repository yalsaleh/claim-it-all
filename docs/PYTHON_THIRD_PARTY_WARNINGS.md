# Python third-party warnings (Slice 9B)

## First-party

Project code must not use `datetime.utcnow()` or FastAPI `on_event` deprecations.
Count target: **0** first-party deprecation warnings in Pytest under Python 3.12.

## botocore `datetime.utcnow()`

| Field | Value |
| --- | --- |
| Package | `botocore` (via `boto3`) |
| Prior pin | `boto3==1.35.86` (pulled older botocore with `utcnow`) |
| Upgrade | `boto3==1.40.2` / `boto3-stubs[s3]==1.40.2` |
| Upstream | Fixed in botocore ≥ 1.40.2 ([PR #3239](https://github.com/boto/botocore/pull/3239)) |
| Suppression | **None** (no global warning filters) |

If Pytest still reports a botocore `utcnow` warning after this upgrade, treat it as
**third-party-only**, record the installed botocore version, and do not blanket-ignore
`DeprecationWarning` in first-party code.
