# Runbook — Queue backlog

## Symptoms
ARQ depth high; job latency up; worker CPU saturated.

## Immediate actions
1. Identify job_type dominating the backlog (safe metric labels only).
2. Scale workers **or** enable kill-switches for non-critical producers.
3. Check for retry storms / duplicate external webhooks.
4. Confirm tenant limits not being bypassed by a single tenant.
5. Document peak depth and time-to-drain for post-incident review.
