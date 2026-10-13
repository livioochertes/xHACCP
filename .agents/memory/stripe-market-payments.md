---
name: Stripe market payments
description: Market-specific Stripe accounts and safe transition from Viva.
---

Use a dedicated Stripe account for .fr and a separate Stripe account shared by .ro and .com. Stripe is the default for new card checkouts; Viva remains available per market as an admin-toggleable fallback. Existing KitOff subscriptions continue renewing with their original provider, while new KitOff subscriptions use Stripe.

**Why:** The user wants to move new card payments to Stripe without losing a Viva fallback or interrupting existing Viva subscription renewals.

**How to apply:** Route credentials, currency, publishable keys, and webhook signing secrets by account market. Preserve each subscription's stored provider; do not migrate existing subscriptions implicitly.
