---
name: Payment callback idempotency
description: Payment success callbacks and webhooks must atomically claim the paid transition before side effects.
---

Payment providers can deliver a browser callback and a webhook concurrently or repeatedly. The paid transition must be an atomic database update that only succeeds for an order not already marked paid; invoice, email, stock, and logistics side effects run only for the successful claimant.

**Why:** A read-then-update check is race-prone: both delivery paths can observe a pending order and duplicate invoices or notifications.

**How to apply:** When adding another payment method or provider, reuse the same conditional paid transition before running any post-payment processing, and keep duplicate deliveries harmless.