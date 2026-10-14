---
name: Payment callback idempotency
description: Payment success callbacks and webhooks must atomically claim the paid transition before side effects.
---

Payment providers can deliver a browser callback and a webhook concurrently or repeatedly. The paid transition must be an atomic database update that only succeeds for an order not already marked paid; invoice, email, stock, and logistics side effects run only for the successful claimant.

**Why:** A read-then-update check is race-prone: both delivery paths can observe a pending order and duplicate invoices or notifications.

**How to apply:** When adding another payment method or provider, reuse the same conditional paid transition before running any post-payment processing, and keep duplicate deliveries harmless.

If a provider confirms a charge while the local order remains pending, recovery must reuse that same provider transaction and reconcile it before offering another payment attempt. Keep callback/webhook diagnostics useful but exclude customer data, payment credentials, and full provider payloads.

**Why:** A successful charge and a successful local order update are separate outcomes; hiding the reconciliation failure can leave a customer charged with no completed order, while a new payment attempt risks charging them twice.

**How to apply:** For Stripe and other online providers, make retries detect an already-succeeded transaction, run the existing idempotent paid transition, and report clearly that the customer must not pay again until reconciliation finishes.