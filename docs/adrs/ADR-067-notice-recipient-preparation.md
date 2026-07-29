# ADR-067 — Recipient and delivery preparation

| Field | Detail |
|-------|--------|
| Status | Accepted |
| Date | 2026-07-29 |

**Context:** Docs referred to NoticeRecipient; schema uses ObligationRecipient + ContactPoint. Guessed recipients must not be approvable.

**Decision:** NoticeDeliveryPreparation freezes verified recipient/party/contact/method for the package from obligation recipients and contact points. Missing contacts block approval unless controlled exception. No send action.

**Consequences:** Naming contradiction resolved: preparation is package-scoped; ObligationRecipient remains configuration-time.
