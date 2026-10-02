---
name: Market price preservation
description: Durable rollout expectations for marketplace VAT and net/gross display changes.
---

When changing marketplace tax display, retain already-published customer-facing price amounts and the configured market VAT rate. In cart and checkout payment summaries, show both products and shipping net, VAT separately, and a VAT-inclusive total in every market. Service products do not incur shipping; mixed carts calculate shipping and free-shipping thresholds from shippable products only. Other surfaces keep market-specific display rules (France net, Romania gross). Persist shipping gross as charged, with its net/VAT snapshot; never retroactively recalculate existing orders.

**Why:** The user selected a rollout that preserves established visible prices and VAT settings instead of repricing products during migration. Mixing a net product subtotal with gross shipping in the same payment summary is confusing, and service products have no physical delivery.

**How to apply:** Use shippingNetAmount in cart and checkout payment summaries without changing the amount charged or stored. Determine shipping eligibility from authoritative product type, derive net/gross counterparts from the configured market display amount, and persist tax snapshots for later order views.