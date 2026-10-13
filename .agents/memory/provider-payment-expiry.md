---
name: Provider-confirmed payment expiry
description: Rules for releasing voucher reservations when a payment checkout has no terminal callback.
---

Release a pending voucher hold only after the payment provider confirms the checkout is no longer payable. A local age threshold, browser cancel redirect, network error, or capture-denied event alone is not sufficient. Viva's legacy order lookup uses `StateId` 1 (expired) or 2 (cancelled), and its `MerchantTrns` must match the local order. Viva's hosted Cancel Button is enabled separately on each online payment source; its `cancel` return parameter is not proof that the provider checkout is terminal. PayPal can be treated as terminal on a verified void/reversal event or `VOIDED` status; a missing PayPal order is evidence of automatic reversal only after the provider's documented three-hour approval window and a reconciliation grace period.

**Why:** A false expiry can let a personal voucher be reserved by another checkout while the original payment still succeeds. Provider failures and late callbacks can race.

**How to apply:** Keep provider-specific expiry logic bound to the local order and make both failure and paid transitions conditional on the order still being pending. For Viva, configure the cancel control on each market's payment source and return the shopper to checkout; unknown provider/network outcomes must retain the hold. Repeated checks and callbacks must be idempotent.
