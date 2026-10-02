---
name: Market price preservation
description: Durable rollout expectations for marketplace VAT and net/gross display changes.
---

When changing marketplace tax display, retain already-published customer-facing price amounts and the configured market VAT rate. Shipping follows the same display basis: France shows net and Romania shows VAT-inclusive. Persist shipping gross as charged, with its net/VAT snapshot; never retroactively recalculate existing orders.

**Why:** The user selected a rollout that preserves established visible prices and VAT settings instead of repricing products during migration. Shipping must display in the market's familiar basis while stored order totals still match the amount charged.

**How to apply:** Derive a missing net/gross counterpart from each market's configured display amount, and persist tax totals at order creation for later invoices, confirmations, and account views.