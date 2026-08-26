---
name: Marketplace category filtering
description: Product category assignments belong to product-market rows; category slugs can repeat and must never be resolved through a global cache.
---

Each product-market association owns its category assignment. Category slugs are unique per marketplace, not globally. Public filtering must first resolve the product's category for the current marketplace, then apply the requested slug.

**Why:** RO, FR, and COM categories must remain independently editable. A single global product category or global slug cache can leak another marketplace's category, hide valid products, or make an edit on one domain affect the others.

**How to apply:** Store category ownership on the product-market association, validate that the category belongs to that market, scope navigation/counts to the domain, and block deletion while either global or market-specific product references exist.