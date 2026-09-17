---
name: No startup market backfills
description: Product marketplace membership must not be inferred or recreated during application startup.
---

Never create a `product_markets` row during cache loading or other startup reconciliation merely because a product has no marketplace rows. A product without a market row may be intentionally removed from every marketplace.

**Why:** A startup orphan-repair routine recreated deleted products in the Romanian marketplace on every deployment restart, undoing admin deletions and causing repeated inactive/extra catalog entries.

**How to apply:** Keep startup reconciliation limited to non-membership metadata, such as filling a missing category on an existing market row. New marketplace rows require an explicit admin/import action for a specific market.