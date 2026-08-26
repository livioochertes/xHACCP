---
name: Composite product invariants
description: Marketplace, currency, and history rules for configurable products assembled from simple products.
---

Composite products are configured independently per marketplace. Every component must have an explicit product-market association for that marketplace, although the component and its market row may be inactive when membership in the composite makes it available there. Composite products cannot be nested and one parent may expose at most eight components.

**Why:** A missing market association or implicit currency fallback can silently sell an unavailable component or relabel a numeric price from one currency as another. The parent price is the storefront reference, while the configurable contents determine the cart total.

**How to apply:** Display the composite parent's marketplace price on the catalog and product page. In the cart and checkout, validate the selected components server-side and use their summed total, persisting names, quantities, unit prices, totals, and currency as an immutable configuration snapshot.

The development and production databases do not automatically share marketplace seed data. When a non-RO marketplace has no category rows, provision independent copies from RO through an authenticated Admin flow before configuring products there.

**Why:** Publishing code does not copy development records into production, so a newly introduced marketplace can otherwise have an empty Admin category selector even though the development database looks complete.

**How to apply:** Keep category provisioning idempotent and never use shared-row or public fallback data as the persistent category structure for a marketplace.

Composite stock is marketplace-specific. A positive stock entered on the composite parent is a manual override; an empty or zero parent stock is calculated as the sum of the configured components' effective stock in that marketplace.

**Why:** The Admin form historically stores an untouched empty stock as zero, so zero must retain automatic-stock semantics for existing composites. Component marketplace overrides must be respected so one storefront cannot borrow stock from another.

**How to apply:** Recalculate the effective parent stock whenever product-market data or component membership changes, and derive `inStock` from the resulting quantity.