---
name: Abandoned cart reminders
description: Product policy for authenticated abandoned-cart email reminders across RO, FR, and COM.
---

The default policy is one reminder after 24 hours of inactivity for each authenticated user and marketplace. A cart change creates a new eligible snapshot; an unchanged cart must not receive repeated reminders.

**Why:** The reminder should recover unfinished purchases without becoming recurring spam, and the same user may have independent carts on different marketplace domains.

**How to apply:** Keep reminder state keyed by user and market, compare the stored cart snapshot with the cart's latest activity timestamp, and resolve product prices, currency, sender, language, and checkout URL from the persisted market.