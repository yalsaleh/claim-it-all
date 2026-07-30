# Runbook — Pilot pause

## When
Provider incident, data integrity doubt, auth anomaly, restore in progress.

## Actions
1. Enable kill-switches: `connector_ingestion`, `scheduled_synchronization`,
   `webhook_processing`, `email_delivery`, `ai_calls` (as needed),
   `background_detection`, `export_generation`.
2. Suspend affected tenant(s) if blast radius is tenant-local (ADR-106).
3. Communicate status to incident contacts (ADR-119).
4. Do not “temporarily” enable fake providers.
5. Resume only after `production:validate`, integrity checks, and explicit approval.
