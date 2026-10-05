---
name: Market-specific legal pages
description: Keep jurisdiction-specific legal copy and seller/return details isolated by storefront market.
---

Legal pages must select their rules, seller identity, and return destination by storefront market/domain, independently of the visitor's selected UI language. A translated page on a French domain must still show French-market legal details.

**Why:** The user stated that applicable legislation and seller/contact addresses differ across storefront domains. Reusing the same jurisdiction text or contact details risks showing consumers the wrong legal identity or return instructions.

**How to apply:** Use the request/domain market for legal copy and seller data; use UI language only for translation. If a market's jurisdiction or return address is not confirmed, do not invent one—retain an explicit contact/instructions fallback.
