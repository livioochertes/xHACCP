---
name: Unpaid checkout visibility
description: Admin handling rule for online checkout attempts that have no confirmed payment.
---

Keep unpaid Viva and PayPal checkout records for reconciliation, but present them separately from normal operational orders in admin. Do not delete them just because a shopper left checkout or a payment failed. Paid and refunded orders remain in the normal order list.

**Why:** A later provider callback or recovery check may still confirm the payment, while showing these rows as ordinary orders can cause fulfillment before payment.

**How to apply:** Keep unconfirmed online attempts in a dedicated payment-attempt view; don't change storage, voucher, callback, or reconciliation state when changing only the admin view.
