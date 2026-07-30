# ADR-111 — Metrics and tracing

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

## Context

Queue lag, backup failures, provider errors, and kill-switch state need metrics. High-
cardinality labels (email, documentId, userId, notice body fragments) create cost,
cardinality explosion, and privacy risk.

## Decision

### Metrics

- Use low-cardinality labels only: `environment`, `provider`, `job_type`, `status`,
  optionally coarse `tenant` bucketing when explicitly approved
- `@contractradar/platform` `assertSafeMetricLabels` rejects forbidden keys and sensitive
  values (emails, URLs, overlong strings)
- Core series: request latency, auth failures, outbox lag, queue depth, scanner outcomes,
  backup success/failure, kill-switch flips, active support-grant count, limit rejections

Local `MetricsRegistry` supports Mode A unit tests; production exporters (Prometheus /
OTLP) are deployment-time wiring — **not claimed live** in Slice 9.

### Tracing

- Spans cover web → queue → worker with the same redaction rules as logs
- No PII, tokens, or document bodies in span attributes
- Trace IDs align with `request_id` / `job_id` log fields where possible

## Consequences

- Observability remains useful for pilots without becoming a data-exfiltration channel
- Guide: [OBSERVABILITY.md](../OBSERVABILITY.md)
