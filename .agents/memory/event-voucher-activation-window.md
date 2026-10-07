---
name: Event voucher activation window
description: Opt-in creates a minimal Client account; successful first payment determines whether a voucher opens a 12-month benefit or stays one-time.
---

After explicit opt-in, create or associate a minimal Client account by the signup email; billing and delivery details are not required. Send a new account a unique, expiring password-setup link, and never replace an existing account's password.

Setting a password is not a prerequisite for the first order: a guest may redeem the personal voucher with the signup email, but a different email or authenticated account must be rejected. The order must still be attached to the voucher owner's Client account.

A voucher is usable on the first order. A successful paid redemption within 30 days of opt-in starts a 12-month validity period from the successful payment; the same client may reuse it according to the promotion's rules. If no payment succeeds within 30 days, the voucher remains a one-time discount for a later first order and does not activate the 12-month repeat benefit. Failed, cancelled, or unpaid orders do not activate or consume it.

For an unactivated personal voucher, an unpaid order is a temporary reservation, not a redemption. Only one pending first-use order may hold the available first-use capacity. A failed or cancelled order must leave the pending-payment state so another checkout can reserve it; payment success atomically consumes the use.

**Why:** The user confirmed automatic Client creation at opt-in, password setup as an optional step before first purchase, email-bound guest redemption, 12 months from the first successful paid order within 30 days, and a one-time discount if that activation window is missed. Inferring the temporary hold from pending orders preserves that distinction without adding a separate reservation record.

**How to apply:** Bind personal vouchers and qualifying orders to the Client account/email across checkout paths. Change activation and validity only after an idempotent successful-payment transition; derive reservations from pending orders and release them on verified failure or cancellation. Do not require billing or shipping information at opt-in.