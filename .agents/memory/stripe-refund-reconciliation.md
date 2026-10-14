---
name: Stripe refund reconciliation
description: Verify provider-side full refunds before changing local order payment status.
---

Only mark an order refunded after the matching Stripe PaymentIntent and charge are verified and successful refund records cover the full captured amount. The admin bulk-refund helper is a simulation, not a Stripe refund operation. Keep the order record and mark it cancelled/refunded; do not delete it.

**Why:** Stripe can complete a refund while the local order remains pending, and a local status change alone neither refunds money nor proves the provider did.

**How to apply:** Match the Stripe payment to the local order, market, currency, and amount; require successful full-refund records before setting the local payment status to `refunded`.
