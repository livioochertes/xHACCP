---
name: Admin order currency display
description: Keep all Admin order monetary values and exports consistent with the order's market currency.
---

Use the configured currency for the order's market, with domain defaults of RON for `.ro` and EUR for `.fr` and `.com`. Apply the same currency to list totals, item prices, subtotal, discount, shipping, detail totals, and exports. Mixed-market exports must include an explicit currency column. Display formatting labels the stored numeric amount; it must not perform an implicit conversion.

**Why:** Admin orders can span multiple markets, and hardcoded `lei` can misrepresent EUR amounts. Converting while displaying would also make the shown order value inaccurate.

**How to apply:** Route Admin order monetary displays and exports through one order-aware formatter, and ensure new checkout/manual orders persist the market currency.