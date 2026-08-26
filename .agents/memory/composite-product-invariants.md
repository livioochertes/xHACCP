---
name: Composite product invariants
description: Marketplace, currency, and history rules for configurable products assembled from simple products.
---

Composite products are configured independently per marketplace. Every component must have an explicit product-market association for that marketplace, although the component and its market row may be inactive when membership in the composite makes it available there. Composite products cannot be nested and one parent may expose at most eight components.

**Why:** A missing market association or implicit currency fallback can silently sell an unavailable component or relabel a numeric price from one currency as another. Historical orders must remain understandable even after component names and prices change.

**How to apply:** Treat marketplace settings as the authoritative currency for a composite parent and require explicit compatible component market prices when the base currency differs. Recalculate from current component data server-side at checkout, then persist the names, quantities, unit prices, totals, and currency as an immutable order-item snapshot.

The development and production databases do not automatically share marketplace seed data. When a non-RO marketplace has no category rows, provision independent copies from RO through an authenticated Admin flow before configuring products there.

**Why:** Publishing code does not copy development records into production, so a newly introduced marketplace can otherwise have an empty Admin category selector even though the development database looks complete.

**How to apply:** Keep category provisioning idempotent and never use shared-row or public fallback data as the persistent category structure for a marketplace.