---
name: Market-specific legal pages
description: Keep jurisdiction-specific legal copy and seller/return details isolated by storefront market.
---

Legal pages must select their rules, seller identity, and return destination by storefront market/domain, independently of the visitor's selected UI language. A translated page on a French domain must still show French-market legal details.

Company name, contact details, postal address, VAT number, and registration number must come from that market's company-settings record, not page-level constants. Format phone numbers only for display; do not overwrite stored values or substitute another market's record when a field is empty.

**Why:** The user stated that applicable legislation and seller/contact addresses differ across storefront domains. The live French company-settings record contains its own phone and address, while its registration-number field is empty; hardcoded page values can therefore be stale or misleading.

**How to apply:** Use the request/domain market for legal copy and seller data; use UI language only for translation. If a market's required company field, jurisdiction, or return address is not confirmed, do not invent it or borrow another market's value—retain an explicit contact/instructions fallback and surface the missing setting.

The business/legal owner confirmed that the French storefront is B2B-only with no consumer sales. Apply this scope only to the French storefront; do not carry its terms into Romanian or international markets.

**Why:** The B2B classification can affect consumer-rights and mediation language, and the owner has now confirmed it for the French market.

**How to apply:** Use the B2B scope only for French-market legal content. Keep consumer-facing terms for other markets governed by their own approved copy.
