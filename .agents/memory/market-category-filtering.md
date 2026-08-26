---
name: Marketplace category filtering
description: Category slugs can repeat across marketplace-specific category rows and must not be resolved through a global slug-only product cache.
---

Category slugs are unique per marketplace, not globally. Public product filtering must match the requested slug against the product's category slug and then apply the current marketplace availability overlay; a global slug map can select an empty or incorrect duplicate category.

**Why:** Independent RO/FR/COM category rows share user-facing slugs, while products keep one category reference and marketplace availability is stored separately. A global slug cache makes valid products disappear when duplicate rows are loaded in a different order.

**How to apply:** Keep storefront navigation scoped to the current marketplace, use the Shop visibility flag for the sidebar, and calculate category counts from products that are active in that same marketplace.