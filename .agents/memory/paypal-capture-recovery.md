---
name: PayPal capture recovery
description: Durable recovery rule for direct PayPal capture confirmation.
---

Direct PayPal checkout must treat the browser callback as a convenience, not the only confirmation path. A capture can succeed even when the capture response or redirect is lost, so a verified provider webhook must reconcile the persisted provider order ID and reuse the same atomic paid transition and side-effect guard.

**Why:** A lost callback otherwise leaves a customer charged while the local order remains pending and no invoice or fulfillment transition occurs.

**How to apply:** Keep callback and webhook finalization behavior shared, verify PayPal webhook signatures before trusting event data, and make capture, transaction persistence, invoice generation, and email replay-safe.