# Threat model — Provider onboarding (Slice 9)

## Assets
- Provider adapter configurations
- Secret references for connectors/delivery/AI
- Kill-switch state
- Pilot tenant scopes
- Staging soak evidence

## Threats and controls

| Threat | Control |
|--------|---------|
| Fake provider in PILOT/PRODUCTION | Environment policy reject (ADR-103/104) |
| Local-capture treated as prod | Forbidden in PILOT/PRODUCTION |
| Raw secrets in DB/UI | Secret references only (ADR-105) |
| Enable without kill-switch | ADR-117 requires kill-switch key (ADR-118) |
| Scope creep across projects | Existing ConnectorProjectScope approval (ADR-087) |
| Webhook forgery after enable | Existing signature + replay controls |
| Autonomous send via new provider | Human authorization boundary unchanged (ADR-074/086) |
| Docs imply live enablement | Explicit non-goal: no real providers onboarded in Slice 9 |

## Explicit non-goals
Live Microsoft/Google/EDMS/SMTP onboarding; production traffic through new providers.
