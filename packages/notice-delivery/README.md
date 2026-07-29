# `@contractradar/notice-delivery`

Deterministic controlled-delivery domain logic for Slice 7.

- Immutable dispatch package snapshots
- Send authorization state machine
- Recipient aggregate status
- Idempotency keys and retry classification
- Delivery risk indicators
- Deemed-receipt advisory calculation
- Fake / local-capture provider contracts

No autonomous sending. Providers never receive full database models.
