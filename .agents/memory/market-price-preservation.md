---
name: Market price preservation
description: Durable rollout expectations for marketplace VAT and net/gross display changes.
---

When changing marketplace tax display, retain already-published customer-facing price amounts and the configured market VAT rate. New VAT snapshots must not retroactively recalculate existing orders.

**Why:** The user selected a rollout that preserves established visible prices and VAT settings instead of repricing products during migration.

**How to apply:** Derive a missing net/gross counterpart from each market's existing visible price, and persist tax totals at order creation for later invoices and confirmations.