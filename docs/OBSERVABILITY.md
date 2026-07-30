# Observability (Slice 9)

## Logs (ADR-110)

Structured JSON with `request_id` / `job_id` / `tenant_id` / `project_id` / `event` /
`error_code`. Redact secrets; never log notice bodies or clause text at info in restricted
envs.

## Metrics & tracing (ADR-111)

Low-cardinality labels only. `assertSafeMetricLabels` rejects emails, tokens, overlong
values. Core series: latency, auth failures, outbox lag, queue depth, scanner outcomes,
backup success/failure, kill-switch flips, support-grant count, limit rejections.

## Health (ADR-112)

- Liveness: process up
- Readiness: deps + `production:validate` policy for restricted envs

Slice 9 does not claim a live APM vendor integration — Mode A provides primitives and
policy.
