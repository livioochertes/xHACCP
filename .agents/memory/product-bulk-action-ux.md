---
name: Product bulk-action UX
description: Safety and interaction convention for bulk product actions in Admin
---

Product bulk actions should be selected from a dropdown beside the product list, not from a separate modal. Inputs required by an action stay inside that dropdown, and every action requires an explicit confirmation before execution.

**Why:** The requested Admin workflow keeps actions easy to discover like the Excel menu while preventing accidental changes to many products.

**How to apply:** Preserve this interaction when adding or changing product bulk actions. Destructive actions must retain marketplace-scoped warnings and must never execute before confirmation.