---
name: Stripe market payments
description: Market-specific Stripe accounts and safe transition from Viva.
---

Use a dedicated Stripe account for .fr and a separate Stripe account shared by .ro and .com. Stripe is the default for new card checkouts; Viva remains available per market as an admin-toggleable fallback. Existing KitOff subscriptions continue renewing with their original provider, while new KitOff subscriptions use Stripe.

**Why:** The user wants to move new card payments to Stripe without losing a Viva fallback or interrupting existing Viva subscription renewals.

**How to apply:** Route credentials, currency, publishable keys, and webhook signing secrets by account market. Preserve each subscription's stored provider; do not migrate existing subscriptions implicitly.

Wallet payment methods also require each storefront domain to be enabled separately in the matching Stripe account: `xhaccp.fr` in FR, and `xhaccp.ro` plus `xhaccp.com` in RO/.com. All three are currently registered and report Apple Pay and Google Pay as active.

**Why:** Stripe only exposes Apple Pay and Google Pay through Elements on registered payment-method domains, and the storefronts use separate Stripe accounts.

**How to apply:** If a storefront hostname or account mapping changes, register and enable that exact domain in its market's Stripe account; add `www` only if checkout is served there without redirecting to the root domain.
