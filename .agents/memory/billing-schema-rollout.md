---
name: Billing schema rollout
description: Schema prerequisites for market billing-provider selection and Pennylane product mappings
---

The application reads market billing-provider selection and Pennylane product mappings during startup cache loading. A deployment with the TypeScript schema updated but the database columns missing can keep the HTTP process alive while cache initialization fails.

**Why:** The project has historically kept SQL migration files separate from the runtime startup path, so an unapplied migration can surface only after a restart.

**How to apply:** Before declaring a billing-provider rollout ready, verify the development schema has `market_settings.invoice_provider`, `product_markets.pennylane_product_id`, and `product_markets.pennylane_accounting_account_id`; apply the idempotent migration before restarting the app.