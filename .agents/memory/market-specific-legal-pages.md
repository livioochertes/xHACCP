---
name: Market-specific legal pages
description: Keep jurisdiction-specific legal copy and seller/return details isolated by storefront market.
---

Legal pages must select their rules, seller identity, and return destination by storefront market/domain, independently of the visitor's selected UI language. A translated page on a French domain must still show French-market legal details.

Company name, contact details, postal address, VAT number, and registration number must come from that market's company-settings record, not page-level constants. Format phone numbers only for display; do not overwrite stored values or substitute another market's record when a field is empty.

**Why:** The user stated that applicable legislation and seller/contact addresses differ across storefront domains. The live French company-settings record contains its own phone and address, while its registration-number field is empty; hardcoded page values can therefore be stale or misleading.

**How to apply:** Use the request/domain market for legal copy and seller data; use UI language only for translation. If a market's required company field, jurisdiction, or return address is not confirmed, do not invent it or borrow another market's value—retain an explicit contact/instructions fallback and surface the missing setting.
