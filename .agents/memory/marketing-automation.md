---
name: Marketing automation
description: Market-aware abandoned-cart thresholds and consent-gated marketing campaigns
---

Reminder timing and campaign audiences must be scoped to the marketplace (`ro`, `fr`, or `com`) rather than treated as global user settings. Marketing recipients require both email communication and promotions consent.

**Why:** The same account can use multiple storefronts with different currencies, senders, legal context, and customer intent; mixing audiences or sending without both preferences risks incorrect communication and compliance issues.

**How to apply:** Keep threshold configuration per market, preserve reminder progress per cart snapshot and threshold, and calculate campaign previews/send lists from the selected segment at send time.

AI recommendation campaign creation and editing must acquire the same market-scoped PostgreSQL transaction advisory lock before checking date overlap and writing the campaign.

**Why:** A separate overlap read and write lets concurrent requests both pass; locking by market allows identical schedules in separate markets.

**How to apply:** Any future code path that can create or reschedule these campaigns must use the same lock namespace and perform its overlap query and write in the locked transaction.

French imported prospect lists may be used for an invitation only when an administrator confirms the documented B2B contact basis. Importing a contact is not newsletter consent: the recipient must explicitly opt in before receiving newsletter campaigns. Signup offers a 20% voucher, and an unsubscribe suppresses the address from both prospect invitations and newsletters.

**Why:** The user confirmed their list has a documented B2B basis, while requiring the initial invitation to ask permission and offer a 20% voucher; imported contacts must not be silently subscribed.

**How to apply:** Keep this flow France-only, never send on import, record explicit opt-in separately from the invitation basis, and preserve unsubscribe suppression across all prospect lists and campaigns.