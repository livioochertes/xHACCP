---
name: Marketing automation
description: Market-aware abandoned-cart thresholds and consent-gated marketing campaigns
---

Reminder timing and campaign audiences must be scoped to the marketplace (`ro`, `fr`, or `com`) rather than treated as global user settings. Marketing recipients require both email communication and promotions consent.

**Why:** The same account can use multiple storefronts with different currencies, senders, legal context, and customer intent; mixing audiences or sending without both preferences risks incorrect communication and compliance issues.

**How to apply:** Keep threshold configuration per market, preserve reminder progress per cart snapshot and threshold, and calculate campaign previews/send lists from the selected segment at send time.